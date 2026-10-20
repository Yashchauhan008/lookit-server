import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';

const DAYS = 14;

/** Photos uploaded per day (last 14 days, zero-filled) across the caller's events. */
export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    const rows = await db.queryAll<{ day: string; photos: number }>(
        `
            SELECT to_char(d::date, 'YYYY-MM-DD') AS day,
                   COALESCE(c.photos, 0)::int AS photos
            FROM generate_series(
                   (now() AT TIME ZONE 'Asia/Kolkata')::date - ($2::int - 1),
                   (now() AT TIME ZONE 'Asia/Kolkata')::date,
                   interval '1 day'
                 ) AS d
            LEFT JOIN (
              SELECT (ph.created_at AT TIME ZONE 'Asia/Kolkata')::date AS day, COUNT(*) AS photos
              FROM photos ph
              JOIN events e ON e.id = ph.event_id
              WHERE e.owner_id = $1
                AND ph.status IN ('uploaded', 'processing', 'processed', 'indexed')
              GROUP BY 1
            ) c ON c.day = d::date
            ORDER BY d
        `,
        [req.user!.id, DAYS],
    );

    return res.status(STATUS_CODES.OK).json({ daily_uploads: rows });
}
