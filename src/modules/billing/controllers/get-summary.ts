import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import { getUserBilling } from '../billing.helpers.js';

export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    const userId = req.user!.id;
    const billing = await getUserBilling(db, userId);
    const orders = await db.queryAll(
        `
            SELECT o.id, o.kind, o.amount_inr, o.ref_code, o.utr, o.status,
                   o.reject_reason, o.created_at, p.name AS plan_name
            FROM payment_orders o
            LEFT JOIN plans p ON p.id = o.plan_id
            WHERE o.user_id = $1
            ORDER BY o.created_at DESC
            LIMIT 20
        `,
        [userId],
    );

    return res.status(STATUS_CODES.OK).json({ ...billing, orders });
}
