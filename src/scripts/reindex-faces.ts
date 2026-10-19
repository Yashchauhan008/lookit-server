/**
 * Re-enqueue index-faces for photos that are processed/uploaded but not indexed.
 * Usage: npx tsx src/scripts/reindex-faces.ts
 */
import dotenv from 'dotenv';
dotenv.config({ override: true });

import pg from 'pg';
import { enqueueIndexFaces } from '../modules/faces/queues/index-faces.queue.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const { rows } = await pool.query<{ id: string; event_id: string }>(`
  SELECT id, event_id
  FROM photos
  WHERE status IN ('processed', 'uploaded')
    AND (prev_key IS NOT NULL OR orig_key IS NOT NULL)
  ORDER BY created_at ASC
`);

console.log(`Enqueueing index-faces for ${rows.length} photos…`);
for (const row of rows) {
  await enqueueIndexFaces({ photoId: row.id, eventId: row.event_id });
}
console.log('Done');
await pool.end();
process.exit(0);
