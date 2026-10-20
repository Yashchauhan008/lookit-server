import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';

export const ValidationSchema = {
    query: z.object({
        status: z.enum(['open', 'approved', 'rejected', 'all']).default('open'),
    }),
};

export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    const { status } = (req as Request & { validatedQuery: z.infer<typeof ValidationSchema.query> })
        .validatedQuery;

    const orders = await db.queryAll(
        `
            SELECT o.id, o.kind, o.amount_inr, o.ref_code, o.utr, o.status,
                   o.reject_reason, o.created_at, o.reviewed_at,
                   p.code AS plan_code, p.name AS plan_name,
                   u.id AS user_id, u.name AS user_name, u.email AS user_email
            FROM payment_orders o
            JOIN users u ON u.id = o.user_id
            LEFT JOIN plans p ON p.id = o.plan_id
            WHERE CASE $1
                    WHEN 'open' THEN o.status IN ('pending_payment', 'submitted')
                    WHEN 'all' THEN true
                    ELSE o.status = $1
                  END
            ORDER BY o.created_at DESC
            LIMIT 200
        `,
        [status],
    );
    return res.status(STATUS_CODES.OK).json({ orders });
}
