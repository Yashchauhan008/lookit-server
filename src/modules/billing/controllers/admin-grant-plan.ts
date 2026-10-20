import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import {
    ORDER_KIND,
    activatePlan,
    findPlanByCode,
    newRefCode,
    writeAudit,
} from '../billing.helpers.js';

export const ValidationSchema = {
    params: z.object({ id: z.uuid() }),
    body: z.object({
        plan_code: z.string().trim().min(1).max(64),
        utr: z.string().trim().min(1).max(128).optional().nullable(),
    }),
};

/** Instant activation: records an approved order and creates the quota bucket in one transaction. */
export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    const { id: userId } = req.params as z.infer<typeof ValidationSchema.params>;
    const { plan_code, utr } = req.body as z.infer<typeof ValidationSchema.body>;
    const adminId = req.user!.id;

    const target = await db.queryOne<{ id: string; status: string }>(
        `SELECT id, status FROM users WHERE id = $1`,
        [userId],
    );
    if (!target) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'User not found' });
    }
    const plan = await findPlanByCode(db, plan_code);
    if (!plan) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Plan not found' });
    }

    try {
        await db.begin();

        const order = await db.queryOne<{ id: string }>(
            `
                INSERT INTO payment_orders (
                  user_id, kind, plan_id, amount_inr, ref_code, utr,
                  status, reviewed_by, reviewed_at, expires_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, 'approved', $7, now(), now())
                RETURNING id
            `,
            [userId, ORDER_KIND[plan.kind], plan.id, plan.price_inr, newRefCode(), utr ?? null, adminId],
        );
        const purchase = await activatePlan(db, { userId, planId: plan.id, orderId: order!.id });
        await writeAudit(db, adminId, 'billing.grant', 'user', userId, {
            plan_code: plan.code,
            order_id: order!.id,
            purchase_id: purchase!.id,
        });

        await db.commit();
        return res
            .status(STATUS_CODES.CREATED)
            .json({ message: `${plan.name} activated`, purchase_id: purchase!.id });
    } catch (error) {
        await db.rollback();
        throw error;
    }
}
