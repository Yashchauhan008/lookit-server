import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import { signedGetUrl } from '@/shared/configs/media-storage.js';
import { getConsentVersion, loadPublicEventBySlug } from '../guest.helpers.js';
import { readScanToken, type ScanRow } from '../guest-scans.helpers.js';

export const slugParam = z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .min(3)
    .max(64);

export const ValidationSchema = {
    params: z.object({ slug: slugParam }),
    body: z.object({ token: z.string().min(20).max(4000) }),
};

/**
 * Re-open a guest's saved matches from the scan we stored: no Rekognition call.
 * Also reports how many photos were added since, so the guest only rescans when it can change the answer.
 */
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
        return res.status(STATUS_CODES.UNAUTHORIZED).json({ message: 'Saved results are no longer valid', code: 'scan_invalid' });
    }

    const scan = await db.queryOne<ScanRow>(
        `SELECT * FROM guest_scans WHERE id = $1 AND event_id = $2 AND deleted_at IS NULL`,
        [payload.scan_id, event.id],
    );
    if (!scan) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Saved results were deleted', code: 'scan_gone' });
    }

    if (scan.consent_version !== (await getConsentVersion(db))) {
        return res.status(STATUS_CODES.CONFLICT).json({ message: 'Please review the updated terms', code: 'consent_changed' });
    }

    const rows = scan.matched_photo_ids.length
        ? await db.queryAll<{
              id: string;
              thumb_key: string | null;
              prev_key: string | null;
              orig_key: string | null;
              original_filename: string | null;
              faces_count: number;
          }>(
              `
                SELECT id, thumb_key, prev_key, orig_key, original_filename, faces_count
                FROM photos
                WHERE event_id = $1 AND id = ANY($2::uuid[]) AND status IN ('indexed', 'processed', 'uploaded')
                ORDER BY created_at DESC
              `,
              [event.id, scan.matched_photo_ids],
          )
        : [];

    const photos = await Promise.all(
        rows.map(async (row) => {
            const thumbKey = row.thumb_key || row.prev_key || row.orig_key;
            const previewKey = row.prev_key || row.orig_key;
            return {
                id: row.id,
                original_filename: row.original_filename,
                faces_count: row.faces_count,
                thumb_url: thumbKey ? await signedGetUrl(thumbKey, 3600) : null,
                preview_url: previewKey ? await signedGetUrl(previewKey, 3600) : null,
            };
        }),
    );

    const fresh = await db.queryOne<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM photos
         WHERE event_id = $1 AND status = 'indexed' AND created_at > $2`,
        [event.id, scan.created_at],
    );

    await db.query(`INSERT INTO analytics_events (event_id, type, meta) VALUES ($1, 'cache_hit', $2::jsonb)`, [
        event.id,
        JSON.stringify({ scan_id: scan.id }),
    ]);

    return res.status(STATUS_CODES.OK).json({
        photos,
        match_count: photos.length,
        scanned_at: scan.created_at,
        new_photos: fresh?.n ?? 0,
        status: scan.status,
    });
}
