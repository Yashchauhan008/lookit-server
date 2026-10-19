import { Worker } from 'bullmq';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import Logger from '@/shared/configs/logger.js';
import Database from '@/shared/helpers/database.helper.js';
import {
    MEDIA_BUCKET,
    mediaS3,
    putMediaObject,
} from '@/shared/configs/media-storage.js';
import {
    PROCESS_PHOTO_QUEUE,
    redisConnection,
    type ProcessPhotoJob,
} from '../queues/process-photo.queue.js';
import { enqueueIndexFaces } from '@/modules/faces/queues/index-faces.queue.js';

async function downloadOrig(key: string): Promise<Buffer> {
    const res = await mediaS3.send(
        new GetObjectCommand({
            Bucket: MEDIA_BUCKET,
            Key: key,
        }),
    );
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Empty object for ${key}`);
    return Buffer.from(bytes);
}

/**
 * Download original → write preview (2048px) + thumb (400px) → mark processed.
 */
export function startProcessPhotoWorker() {
    const worker = new Worker<ProcessPhotoJob>(
        PROCESS_PHOTO_QUEUE,
        async (job) => {
            const { photoId, eventId } = job.data;
            const db = await Database.getConnection();
            try {
                const photo = await db.queryOne<{
                    id: string;
                    status: string;
                    orig_key: string | null;
                }>(
                    `SELECT id, status, orig_key FROM photos WHERE id = $1 AND event_id = $2`,
                    [photoId, eventId],
                );
                if (!photo) {
                    Logger.warn(`process-photo: photo ${photoId} missing`);
                    return;
                }
                const needsDerivatives = await db.queryOne<{
                    thumb_key: string | null;
                    prev_key: string | null;
                }>(`SELECT thumb_key, prev_key FROM photos WHERE id = $1`, [photoId]);

                if (
                    (photo.status === 'processed' || photo.status === 'indexed') &&
                    needsDerivatives?.thumb_key &&
                    needsDerivatives?.prev_key
                ) {
                    return;
                }
                if (!photo.orig_key) {
                    throw new Error(`photo ${photoId} has no orig_key`);
                }

                await db.query(
                    `
                        UPDATE photos
                        SET status = 'processing', updated_at = now()
                        WHERE id = $1 AND status IN ('uploaded', 'processing')
                    `,
                    [photoId],
                );

                const orig = await downloadOrig(photo.orig_key);
                const meta = await sharp(orig, { failOn: 'none' }).rotate().metadata();

                const previewBuf = await sharp(orig, { failOn: 'none' })
                    .rotate()
                    .resize({
                        width: 2048,
                        height: 2048,
                        fit: 'inside',
                        withoutEnlargement: true,
                    })
                    .webp({ quality: 82 })
                    .toBuffer();

                const thumbBuf = await sharp(orig, { failOn: 'none' })
                    .rotate()
                    .resize({
                        width: 400,
                        height: 400,
                        fit: 'inside',
                        withoutEnlargement: true,
                    })
                    .webp({ quality: 75 })
                    .toBuffer();

                const prevKey = `prev/${eventId}/${photoId}.webp`;
                const thumbKey = `thumb/${eventId}/${photoId}.webp`;

                await putMediaObject(prevKey, previewBuf, 'image/webp');
                await putMediaObject(thumbKey, thumbBuf, 'image/webp');

                await db.query(
                    `
                        UPDATE photos
                        SET status = 'processed',
                            prev_key = $2,
                            thumb_key = $3,
                            width = $4,
                            height = $5,
                            updated_at = now()
                        WHERE id = $1
                    `,
                    [
                        photoId,
                        prevKey,
                        thumbKey,
                        meta.width ?? null,
                        meta.height ?? null,
                    ],
                );

                Logger.info(`process-photo done for ${photoId}`);
                try {
                    await enqueueIndexFaces({ photoId, eventId });
                } catch (err) {
                    Logger.error(`enqueue index-faces failed for ${photoId}`, {
                        stack: err instanceof Error ? err.stack : String(err),
                    });
                }
            } catch (err) {
                await db.query(
                    `
                        UPDATE photos
                        SET status = 'failed',
                            error = $2,
                            updated_at = now()
                        WHERE id = $1
                    `,
                    [photoId, err instanceof Error ? err.message.slice(0, 500) : 'process failed'],
                );
                throw err;
            } finally {
                db.release();
            }
        },
        {
            connection: redisConnection(),
            concurrency: 2,
        },
    );

    worker.on('failed', (job, err) => {
        Logger.error(`process-photo failed ${job?.id}: ${err.message}`, { stack: err.stack });
    });

    Logger.info('process-photo worker started');
    return worker;
}
