import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';

export async function Controller(
    _req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    const stats = await db.queryOne(
        `
            SELECT
              (SELECT COUNT(*)::int FROM users) AS customers,
              (SELECT COUNT(*)::int FROM payment_orders WHERE status IN ('pending_payment', 'submitted')) AS pending_orders,
              (SELECT COUNT(DISTINCT user_id)::int FROM plan_purchases
                 WHERE status IN ('active', 'exhausted') AND upload_window_end > now()) AS active_customers,
              (SELECT COALESCE(SUM(photos_used), 0)::int FROM plan_purchases) AS photos_used,
              (SELECT COALESCE(SUM(amount_inr), 0)::int FROM payment_orders WHERE status = 'approved') AS revenue_inr
        `,
    );
    const plans = await db.queryAll(
        `SELECT id, code, name, kind, price_inr, photo_quota, duration_days
         FROM plans WHERE is_active = true ORDER BY sort_order ASC`,
    );
    return res.status(STATUS_CODES.OK).json({ stats, plans });
}
