import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import { releaseExpiredSessions } from '@/modules/uploads/quota.service.js';

export const ValidationSchema = {
    query: z.object({
        q: z.string().trim().max(120).optional(),
    }),
};

export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    const { q } = (req as Request & { validatedQuery: z.infer<typeof ValidationSchema.query> })
        .validatedQuery;
    await releaseExpiredSessions(db);
    const like = q ? `%${q.replace(/[%_]/g, '\\$&')}%` : null;

    const users = await db.queryAll(
        `
            SELECT u.id, u.name, u.email, u.role, u.studio_name, u.status, u.created_at,
                   COALESCE(b.quota, 0)::int AS quota,
                   COALESCE(b.used, 0)::int AS used,
                   COALESCE(b.reserved, 0)::int AS reserved,
                   b.expires_at,
                   cp.name AS plan_name,
                   (SELECT COUNT(*)::int FROM events e WHERE e.owner_id = u.id AND e.status <> 'deleted') AS events
            FROM users u
            LEFT JOIN LATERAL (
              SELECT SUM(photo_quota) AS quota, SUM(photos_used) AS used,
                     SUM(photos_reserved) AS reserved, MAX(upload_window_end) AS expires_at
              FROM plan_purchases
              WHERE user_id = u.id AND status IN ('active', 'exhausted') AND upload_window_end > now()
            ) b ON true
            LEFT JOIN LATERAL (
              SELECT p.name
              FROM plan_purchases pp JOIN plans p ON p.id = pp.plan_id
              WHERE pp.user_id = u.id AND p.kind <> 'topup'
                AND pp.status IN ('active', 'exhausted') AND pp.upload_window_end > now()
              ORDER BY pp.upload_window_end DESC
              LIMIT 1
            ) cp ON true
            WHERE ($1::text IS NULL OR u.email ILIKE $1 OR u.name ILIKE $1 OR u.studio_name ILIKE $1)
            ORDER BY (u.role = 'admin') DESC, u.created_at DESC
            LIMIT 200
        `,
        [like],
    );

    return res.status(STATUS_CODES.OK).json({ users });
}
