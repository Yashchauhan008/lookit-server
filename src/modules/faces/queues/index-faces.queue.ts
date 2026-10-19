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

export const INDEX_FACES_QUEUE = 'index-faces';

export type IndexFacesJob = {
    photoId: string;
    eventId: string;
};

let queue: Queue<IndexFacesJob> | null = null;

export function getIndexFacesQueue(): Queue<IndexFacesJob> {
    if (!queue) {
        queue = new Queue<IndexFacesJob>(INDEX_FACES_QUEUE, {
            connection: redisConnection(),
            defaultJobOptions: {
                attempts: 5,
                backoff: { type: 'exponential', delay: 8000 },
                removeOnComplete: 1000,
                removeOnFail: 5000,
            },
        });
    }
    return queue;
}

export async function enqueueIndexFaces(job: IndexFacesJob): Promise<void> {
    await getIndexFacesQueue().add('index', job, {
        jobId: `index-${job.photoId}`,
    });
}

export { redisConnection };
