import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import { activatePlan, writeAudit } from '../billing.helpers.js';

export const ValidationSchema = {
    params: z.object({ id: z.uuid() }),
    body: z.object({
        decision: z.enum(['approve', 'reject']),
        reason: z.string().trim().max(500).optional().nullable(),
    }),
};

export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    const { id } = req.params as z.infer<typeof ValidationSchema.params>;
    const { decision, reason } = req.body as z.infer<typeof ValidationSchema.body>;
    const adminId = req.user!.id;

    try {
        await db.begin();

        const order = await db.queryOne<{
            id: string;
            user_id: string;
            plan_id: string | null;
            status: string;
        }>(`SELECT id, user_id, plan_id, status FROM payment_orders WHERE id = $1 FOR UPDATE`, [id]);

        if (!order) {
            await db.rollback();
            return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Order not found' });
        }
        if (order.status !== 'pending_payment' && order.status !== 'submitted') {
            await db.rollback();
            return res
                .status(STATUS_CODES.CONFLICT)
                .json({ message: `Order is already ${order.status}` });
        }

        if (decision === 'approve') {
            if (!order.plan_id) {
                await db.rollback();
                return res.status(STATUS_CODES.CONFLICT).json({ message: 'Order has no plan' });
            }
            await db.query(
                `UPDATE payment_orders
                 SET status = 'approved', reviewed_by = $2, reviewed_at = now(), updated_at = now()
                 WHERE id = $1`,
                [id, adminId],
            );
            await activatePlan(db, { userId: order.user_id, planId: order.plan_id, orderId: id });
        } else {
            await db.query(
                `UPDATE payment_orders
                 SET status = 'rejected', reject_reason = $3, reviewed_by = $2,
                     reviewed_at = now(), updated_at = now()
                 WHERE id = $1`,
                [id, adminId, reason ?? null],
            );
        }

        await writeAudit(db, adminId, `billing.order_${decision}`, 'payment_order', id, {
            user_id: order.user_id,
            reason: reason ?? null,
        });

        await db.commit();
        return res
            .status(STATUS_CODES.OK)
            .json({ message: decision === 'approve' ? 'Order approved and activated' : 'Order rejected' });
    } catch (error) {
        await db.rollback();
        throw error;
    }
}
