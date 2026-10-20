import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import { requireOwnedEvent } from '../uploads.helpers.js';

export const ValidationSchema = {
    params: z.object({ id: z.uuid() }),
    body: z.object({
        files: z
            .array(
                z.object({
                    name: z.string().min(1).max(512),
                    size: z.number().int().min(0),
                }),
            )
            .min(1)
            .max(5000),
    }),
};

/**
 * Which of these files (matched by original filename + size) are already in this event?
 * Only finished uploads count; failed or half-uploaded photos should be re-sent.
 */
export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    const { id: eventId } = req.params as z.infer<typeof ValidationSchema.params>;
    const { files } = req.body as z.infer<typeof ValidationSchema.body>;

    const event = await requireOwnedEvent(db, eventId, req.user!.id);
    if (!event) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Event not found' });
    }

    const duplicates = await db.queryAll<{ name: string; size: string }>(
        `
            SELECT DISTINCT p.original_filename AS name, p.size_bytes::text AS size
            FROM photos p
            JOIN unnest($2::text[], $3::bigint[]) AS t(n, s)
              ON p.original_filename = t.n AND p.size_bytes = t.s
            WHERE p.event_id = $1
              AND p.status IN ('uploaded', 'processing', 'processed', 'indexed')
        `,
        [eventId, files.map((f) => f.name), files.map((f) => f.size)],
    );

    return res.status(STATUS_CODES.OK).json({
        duplicates: duplicates.map((d) => ({ name: d.name, size: Number(d.size) })),
    });
}
