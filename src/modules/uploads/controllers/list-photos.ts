import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import { requireOwnedEvent, publicPhoto, type PhotoRow } from '../uploads.helpers.js';
import { publicObjectUrl } from '@/shared/configs/r2.js';

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
              AND status <> 'failed'
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
              AND status <> 'failed'
        `,
        [eventId],
    );

    return res.status(STATUS_CODES.OK).json({
        photos: rows.map((row) => {
            const base = publicPhoto(row);
            return {
                ...base,
                thumb_url: row.thumb_key ? publicObjectUrl(row.thumb_key) : null,
                preview_url: row.prev_key ? publicObjectUrl(row.prev_key) : null,
            };
        }),
        total: Number(total?.count ?? 0),
    });
}
