import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import { publicEvent, type EventRow } from '../events.helpers.js';

export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    const rows = await db.queryAll<EventRow>(
        `
            SELECT e.*,
                   COALESCE(
                     (SELECT COUNT(*)::int FROM photos p WHERE p.event_id = e.id),
                     0
                   ) AS photo_count
            FROM events e
            WHERE e.owner_id = $1
              AND e.status <> 'deleted'
            ORDER BY e.created_at DESC
        `,
        [req.user!.id],
    );

    return res.status(STATUS_CODES.OK).json({
        events: rows.map(publicEvent),
    });
}
