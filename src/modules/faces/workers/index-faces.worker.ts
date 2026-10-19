import { Worker } from 'bullmq';
import sharp from 'sharp';
import Logger from '@/shared/configs/logger.js';
import Database from '@/shared/helpers/database.helper.js';
import { GetObjectCommand, MEDIA_BUCKET, mediaS3 } from '@/shared/configs/media-storage.js';
import { createFaceEngine } from '../face-engine.factory.js';
import { assertFaceApiBudget } from '../face-usage.service.js';
import {
    INDEX_FACES_QUEUE,
    redisConnection,
    type IndexFacesJob,
} from '../queues/index-faces.queue.js';

async function downloadKey(key: string): Promise<Buffer> {
    const res = await mediaS3.send(
        new GetObjectCommand({ Bucket: MEDIA_BUCKET, Key: key }),
    );
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Empty object ${key}`);
    return Buffer.from(bytes);
}

export function startIndexFacesWorker() {
    const worker = new Worker<IndexFacesJob>(
        INDEX_FACES_QUEUE,
        async (job) => {
            const { photoId, eventId } = job.data;
            const db = await Database.getConnection();
            try {
                const photo = await db.queryOne<{
                    id: string;
                    status: string;
                    prev_key: string | null;
                    orig_key: string | null;
                }>(
                    `
                        SELECT id, status, prev_key, orig_key
                        FROM photos
                        WHERE id = $1 AND event_id = $2
                    `,
                    [photoId, eventId],
                );

                if (!photo) {
                    Logger.warn(`index-faces: photo ${photoId} missing`);
                    return;
                }
                if (photo.status === 'indexed') return;

                const sourceKey = photo.prev_key || photo.orig_key;
                if (!sourceKey) throw new Error('No image key to index');

                await assertFaceApiBudget(db, eventId, 1);

                const raw = await downloadKey(sourceKey);
                // Rekognition needs JPEG/PNG under 5MB
                const jpeg = await sharp(raw, { failOn: 'none' })
                    .rotate()
                    .resize({
                        width: 2048,
                        height: 2048,
                        fit: 'inside',
                        withoutEnlargement: true,
                    })
                    .jpeg({ quality: 85 })
                    .toBuffer();

                if (jpeg.byteLength > 5 * 1024 * 1024) {
                    throw new Error('Index image exceeds 5MB after resize');
                }

                const engine = createFaceEngine(db);
                const faces = await engine.indexPhoto(eventId, photoId, jpeg);

                await db.begin();
                try {
                    await db.query(`DELETE FROM faces WHERE photo_id = $1`, [photoId]);
                    for (const face of faces) {
                        await db.query(
                            `
                                INSERT INTO faces (
                                  photo_id, event_id, external_face_id, box, confidence
                                )
                                VALUES ($1, $2, $3, $4::jsonb, $5)
                                ON CONFLICT (event_id, external_face_id) DO NOTHING
                            `,
                            [
                                photoId,
                                eventId,
                                face.externalFaceId,
                                face.box ? JSON.stringify(face.box) : null,
                                face.confidence,
                            ],
                        );
                    }
                    await db.query(
                        `
                            UPDATE photos
                            SET status = 'indexed',
                                faces_count = $2,
                                updated_at = now()
                            WHERE id = $1
                        `,
                        [photoId, faces.length],
                    );
                    await db.commit();
                } catch (err) {
                    await db.rollback();
                    throw err;
                }

                Logger.info(`index-faces done ${photoId} faces=${faces.length}`);
            } catch (err) {
                await db.query(
                    `
                        UPDATE photos
                        SET error = $2, updated_at = now()
                        WHERE id = $1 AND status <> 'indexed'
                    `,
                    [
                        photoId,
                        err instanceof Error ? err.message.slice(0, 500) : 'index failed',
                    ],
                );
                throw err;
            } finally {
                db.release();
            }
        },
        {
            connection: redisConnection(),
            concurrency: 1,
        },
    );

    worker.on('failed', (job, err) => {
        Logger.error(`index-faces failed ${job?.id}: ${err.message}`, { stack: err.stack });
    });

    Logger.info('index-faces worker started');
    return worker;
}
