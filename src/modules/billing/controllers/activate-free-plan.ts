import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import {
    FREE_PLAN_CODE,
    ORDER_KIND,
    activatePlan,
    findPlanByCode,
    newRefCode,
    writeAudit,
} from '../billing.helpers.js';

/** Self-serve free plan: once per account, no payment, no admin needed. */
export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    const userId = req.user!.id;
    const plan = await findPlanByCode(db, FREE_PLAN_CODE);
    if (!plan) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Free plan is not available' });
    }

    try {
        await db.begin();

        // Serialise concurrent clicks for the same account.
        await db.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);

        const used = await db.queryOne(
            `SELECT 1 FROM plan_purchases WHERE user_id = $1 AND plan_id = $2 LIMIT 1`,
            [userId, plan.id],
        );
        if (used) {
            await db.rollback();
            return res.status(STATUS_CODES.CONFLICT).json({
                message: 'The free plan has already been used on this account.',
                code: 'free_plan_used',
            });
        }

        const order = await db.queryOne<{ id: string }>(
            `
                INSERT INTO payment_orders (
                  user_id, kind, plan_id, amount_inr, ref_code, status, reviewed_at, expires_at
                )
                VALUES ($1, $2, $3, 0, $4, 'approved', now(), now())
                RETURNING id
            `,
            [userId, ORDER_KIND[plan.kind], plan.id, newRefCode()],
        );
        const purchase = await activatePlan(db, { userId, planId: plan.id, orderId: order!.id });
        await writeAudit(db, userId, 'billing.free_plan', 'user', userId, {
            purchase_id: purchase!.id,
        });

        await db.commit();
        return res.status(STATUS_CODES.CREATED).json({ message: 'Free plan activated for 30 days' });
    } catch (error) {
        await db.rollback();
        throw error;
    }
}
