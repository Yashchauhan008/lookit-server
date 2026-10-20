import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import { signedGetUrl } from '@/shared/configs/media-storage.js';
import { requireOwnedEvent } from '@/modules/uploads/uploads.helpers.js';

export const ValidationSchema = {
    params: z.object({ id: z.uuid() }),
};

/** Owner view of guest face scans: totals, Rekognition usage, and the saved selfies (latest per guest). */
export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    const { id: eventId } = req.params as z.infer<typeof ValidationSchema.params>;
    const event = await requireOwnedEvent(db, eventId, req.user!.id);
    if (!event) return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Event not found' });

    const stats = await db.queryOne(
        `
            SELECT
              COUNT(*)::int AS total_scans,
              COUNT(DISTINCT guest_id)::int AS unique_guests,
              COUNT(*) FILTER (WHERE status = 'matched')::int AS matched,
              COUNT(*) FILTER (WHERE status = 'no_match')::int AS no_match,
              COUNT(*) FILTER (WHERE status = 'no_face')::int AS no_face
            FROM guest_scans WHERE event_id = $1
        `,
        [eventId],
    );
    const usage = await db.queryOne<{ calls: number }>(
        `SELECT COALESCE(SUM(calls), 0)::int AS calls FROM face_api_usage WHERE event_id = $1`,
        [eventId],
    );
    const saved = await db.queryOne<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM analytics_events WHERE event_id = $1 AND type = 'cache_hit'`,
        [eventId],
    );

    const rows = await db.queryAll<{
        id: string;
        selfie_key: string;
        match_count: number;
        status: string;
        created_at: string;
    }>(
        `
            SELECT id, selfie_key, match_count, status, created_at FROM (
              SELECT DISTINCT ON (guest_id) id, selfie_key, match_count, status, created_at
              FROM guest_scans
              WHERE event_id = $1 AND selfie_key IS NOT NULL AND deleted_at IS NULL
              ORDER BY guest_id, created_at DESC
            ) latest
            ORDER BY created_at DESC
            LIMIT 120
        `,
        [eventId],
    );

    const scans = await Promise.all(
        rows.map(async (r) => ({
            id: r.id,
            match_count: r.match_count,
            status: r.status,
            created_at: r.created_at,
            selfie_url: await signedGetUrl(r.selfie_key, 3600).catch(() => null),
        })),
    );

    return res.status(STATUS_CODES.OK).json({
        stats: { ...stats, face_api_calls: usage?.calls ?? 0, calls_saved: saved?.n ?? 0 },
        scans,
    });
}
