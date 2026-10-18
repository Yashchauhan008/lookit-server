import { Worker } from 'bullmq';
import Logger from '@/shared/configs/logger.js';
import Database from '@/shared/helpers/database.helper.js';
import {
    PROCESS_PHOTO_QUEUE,
    redisConnection,
    type ProcessPhotoJob,
} from '../queues/process-photo.queue.js';

/**
 * Stub processor: marks uploaded → processing → processed.
 * Full sharp/HEIC/preview/thumb pipeline lands next.
 */
export function startProcessPhotoWorker() {
    const worker = new Worker<ProcessPhotoJob>(
        PROCESS_PHOTO_QUEUE,
        async (job) => {
            const { photoId, eventId } = job.data;
            const db = await Database.getConnection();
            try {
                const photo = await db.queryOne<{ id: string; status: string }>(
                    `SELECT id, status FROM photos WHERE id = $1 AND event_id = $2`,
                    [photoId, eventId],
                );
                if (!photo) {
                    Logger.warn(`process-photo: photo ${photoId} missing`);
                    return;
                }
                if (photo.status === 'processed' || photo.status === 'indexed') {
                    return;
                }

                await db.query(
                    `
                        UPDATE photos
                        SET status = 'processing', updated_at = now()
                        WHERE id = $1 AND status IN ('uploaded', 'processing')
                    `,
                    [photoId],
                );

                // TODO: download orig from R2 → sharp preview/thumb → content hash → faces
                await db.query(
                    `
                        UPDATE photos
                        SET status = 'processed',
                            updated_at = now()
                        WHERE id = $1
                    `,
                    [photoId],
                );

                Logger.info(`process-photo stub done for ${photoId}`);
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
