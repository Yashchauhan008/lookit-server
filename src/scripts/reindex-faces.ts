/**
 * Re-enqueue index-faces for photos that are processed/uploaded but not indexed.
 * Usage: npx tsx src/scripts/reindex-faces.ts
 *
 * Removes any prior BullMQ job with the same id (failed/completed) so a fresh
 * attempt is queued — required after IAM fixes or exhausted retries.
 */
import dotenv from 'dotenv';
dotenv.config({ override: true });

import pg from 'pg';
import {
    enqueueIndexFaces,
    getIndexFacesQueue,
} from '../modules/faces/queues/index-faces.queue.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const queue = getIndexFacesQueue();

const { rows } = await pool.query<{ id: string; event_id: string }>(`
  SELECT id, event_id
  FROM photos
  WHERE status IN ('processed', 'uploaded')
    AND (prev_key IS NOT NULL OR orig_key IS NOT NULL)
  ORDER BY created_at ASC
`);

console.log(`Enqueueing index-faces for ${rows.length} photos…`);
let reused = 0;
let fresh = 0;
for (const row of rows) {
    const jobId = `index-${row.id}`;
    const existing = await queue.getJob(jobId);
    if (existing) {
        const state = await existing.getState();
        if (state === 'failed' || state === 'completed') {
            await existing.remove();
            reused++;
        } else if (state === 'waiting' || state === 'delayed' || state === 'active') {
            console.log(`skip ${jobId} (already ${state})`);
            continue;
        } else {
            await existing.remove();
            reused++;
        }
    } else {
        fresh++;
    }
    await enqueueIndexFaces({ photoId: row.id, eventId: row.event_id });
}
console.log(`Done (replaced=${reused}, new=${fresh})`);
await queue.close();
await pool.end();
process.exit(0);
