import { Queue } from 'bullmq';
import env from '@/shared/configs/env.js';

function redisConnection() {
    const u = new URL(env.REDIS_URL);
    return {
        host: u.hostname || '127.0.0.1',
        port: Number(u.port || 6379),
        password: u.password ? decodeURIComponent(u.password) : undefined,
        maxRetriesPerRequest: null as null,
    };
}

export const PROCESS_PHOTO_QUEUE = 'process-photo';

export type ProcessPhotoJob = {
    photoId: string;
    eventId: string;
};

let queue: Queue<ProcessPhotoJob> | null = null;

export function getProcessPhotoQueue(): Queue<ProcessPhotoJob> {
    if (!queue) {
        queue = new Queue<ProcessPhotoJob>(PROCESS_PHOTO_QUEUE, {
            connection: redisConnection(),
            defaultJobOptions: {
                attempts: 5,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: 1000,
                removeOnFail: 5000,
            },
        });
    }
    return queue;
}

export async function enqueueProcessPhoto(job: ProcessPhotoJob): Promise<void> {
    await getProcessPhotoQueue().add('process', job, {
        jobId: `photo:${job.photoId}`,
    });
}

export { redisConnection };
