import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import { ORDER_KIND, findPlanByCode, getUserBilling, newRefCode } from '../billing.helpers.js';

export const ValidationSchema = {
    body: z.object({
        plan_code: z.string().trim().min(1).max(64),
        utr: z.string().trim().min(6).max(128).optional().nullable(),
    }),
};

/** Customer asks for a plan or top-up; an admin approves it (manual UPI). */
export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    const { plan_code, utr } = req.body as z.infer<typeof ValidationSchema.body>;
    const userId = req.user!.id;

    const plan = await findPlanByCode(db, plan_code);
    if (!plan || plan.kind === 'trial') {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Plan not found' });
    }

    if (plan.kind === 'topup') {
        const { current_plan } = await getUserBilling(db, userId);
        if (!current_plan) {
            return res.status(STATUS_CODES.CONFLICT).json({
                message: 'Top-ups need an active plan. Choose a plan first.',
                code: 'no_active_plan',
            });
        }
    }

    const pending = await db.queryOne(
        `SELECT 1 FROM payment_orders
         WHERE user_id = $1 AND plan_id = $2 AND status IN ('pending_payment', 'submitted')`,
        [userId, plan.id],
    );
    if (pending) {
        return res.status(STATUS_CODES.CONFLICT).json({
            message: 'You already have a pending request for this plan.',
            code: 'order_pending',
        });
    }

    const order = await db.queryOne(
        `
            INSERT INTO payment_orders (
              user_id, kind, plan_id, amount_inr, ref_code, utr, status, expires_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, now() + interval '3 days')
            RETURNING id, kind, amount_inr, ref_code, utr, status, created_at
        `,
        [
            userId,
            ORDER_KIND[plan.kind],
            plan.id,
            plan.price_inr,
            newRefCode(),
            utr ?? null,
            utr ? 'submitted' : 'pending_payment',
        ],
    );

    return res.status(STATUS_CODES.CREATED).json({ order });
}
