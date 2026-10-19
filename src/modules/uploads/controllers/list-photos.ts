import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import { requireOwnedEvent, publicPhoto, type PhotoRow } from '../uploads.helpers.js';
import { signedGetUrl } from '@/shared/configs/media-storage.js';

export const ValidationSchema = {
    params: z.object({
        id: z.uuid(),
    }),
    query: z.object({
        limit: z.coerce.number().int().min(1).max(200).default(100),
        offset: z.coerce.number().int().min(0).default(0),
    }),
};

export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    const { id: eventId } = req.params as z.infer<typeof ValidationSchema.params>;
    const query = req.query as unknown as z.infer<typeof ValidationSchema.query>;
    const userId = req.user!.id;

    const event = await requireOwnedEvent(db, eventId, userId);
    if (!event) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Event not found' });
    }

    const rows = await db.queryAll<PhotoRow>(
        `
            SELECT *
            FROM photos
            WHERE event_id = $1
              AND status IN ('uploaded', 'processing', 'processed', 'indexed')
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
        `,
        [eventId, query.limit, query.offset],
    );

    const total = await db.queryOne<{ count: string }>(
        `
            SELECT COUNT(*)::text AS count
            FROM photos
            WHERE event_id = $1
              AND status IN ('uploaded', 'processing', 'processed', 'indexed')
        `,
        [eventId],
    );

    const photos = await Promise.all(
        rows.map(async (row) => {
            const base = publicPhoto(row);
            const viewKey = row.thumb_key || row.prev_key || row.orig_key;
            const previewKey = row.prev_key || row.orig_key;
            let thumb_url: string | null = null;
            let preview_url: string | null = null;
            try {
                if (viewKey) thumb_url = await signedGetUrl(viewKey, 3600);
                if (previewKey) preview_url = await signedGetUrl(previewKey, 3600);
            } catch {
                /* leave null if signing fails */
            }
            return {
                ...base,
                thumb_url,
                preview_url,
            };
        }),
    );

    return res.status(STATUS_CODES.OK).json({
        photos,
        total: Number(total?.count ?? 0),
    });
}
