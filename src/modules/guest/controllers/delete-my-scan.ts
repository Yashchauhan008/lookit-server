import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import { loadPublicEventBySlug } from '../guest.helpers.js';
import { readScanToken, removeSelfieFile } from '../guest-scans.helpers.js';
import { slugParam } from './get-my-results.js';

export const ValidationSchema = {
    params: z.object({ slug: slugParam }),
    body: z.object({ token: z.string().min(20).max(4000) }),
};

/** The guest erases their saved selfie and matches. Aggregate counts for the owner stay, personal data goes. */
export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    const { slug } = req.params as z.infer<typeof ValidationSchema.params>;
    const { token } = req.body as z.infer<typeof ValidationSchema.body>;

    const event = await loadPublicEventBySlug(db, slug);
    if (!event) return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Event not found' });

    const payload = await readScanToken(token);
    if (!payload || payload.event_id !== event.id) {
        return res.status(STATUS_CODES.UNAUTHORIZED).json({ message: 'Invalid token', code: 'scan_invalid' });
    }

    // Wipe every scan this device made for the event, not just the latest one.
    const scans = await db.queryAll<{ id: string; selfie_key: string | null }>(
        `
            WITH me AS (
              SELECT guest_id FROM guest_scans WHERE id = $1 AND event_id = $2
            ),
            prev AS (
              SELECT id, selfie_key FROM guest_scans
              WHERE event_id = $2 AND guest_id IN (SELECT guest_id FROM me) AND deleted_at IS NULL
              FOR UPDATE
            ),
            wiped AS (
              UPDATE guest_scans g
              SET selfie_key = NULL, matched_photo_ids = '{}', match_count = 0, deleted_at = now()
              FROM prev WHERE g.id = prev.id RETURNING g.id
            )
            SELECT prev.id, prev.selfie_key FROM prev
        `,
        [payload.scan_id, event.id],
    );
    await Promise.all(scans.map((s) => removeSelfieFile(s.selfie_key)));

    return res.status(STATUS_CODES.OK).json({ message: 'Your selfie and saved results were deleted' });
}
