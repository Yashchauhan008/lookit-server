import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import { publicEventWithBanner, type EventRow } from '../events.helpers.js';
import env from '@/shared/configs/env.js';

export const ValidationSchema = {
    params: z.object({
        id: z.uuid(),
    }),
};

export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    const { id } = req.params as z.infer<typeof ValidationSchema.params>;

    const row = await db.queryOne<EventRow>(
        `
            SELECT e.*,
                   COALESCE(
                     (SELECT COUNT(*)::int FROM photos p WHERE p.event_id = e.id),
                     0
                   ) AS photo_count
            FROM events e
            WHERE e.id = $1
              AND e.owner_id = $2
              AND e.status <> 'deleted'
        `,
        [id, req.user!.id],
    );

    // IDOR: wrong owner → 404 (not 403)
    if (!row) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Event not found' });
    }

    return res.status(STATUS_CODES.OK).json({
        event: await publicEventWithBanner(row),
        share_url: `${env.APP_BASE_URL}/e/${row.slug}`,
    });
}
