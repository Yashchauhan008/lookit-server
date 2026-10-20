import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import { writeAudit } from '../billing.helpers.js';

export const ValidationSchema = {
    params: z.object({ id: z.uuid() }),
};

export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    const { id } = req.params as z.infer<typeof ValidationSchema.params>;

    const row = await db.queryOne<{ user_id: string }>(
        `UPDATE plan_purchases
         SET status = 'revoked', updated_at = now()
         WHERE id = $1 AND status IN ('active', 'exhausted')
         RETURNING user_id`,
        [id],
    );
    if (!row) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Active purchase not found' });
    }

    await writeAudit(db, req.user!.id, 'billing.revoke', 'plan_purchase', id, { user_id: row.user_id });
    return res.status(STATUS_CODES.OK).json({ message: 'Plan revoked' });
}
