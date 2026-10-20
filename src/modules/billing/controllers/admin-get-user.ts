import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import { getUserBilling } from '../billing.helpers.js';

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
    const user = await db.queryOne(
        `SELECT id, name, email, studio_name, status, created_at FROM users WHERE id = $1`,
        [id],
    );
    if (!user) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'User not found' });
    }
    const billing = await getUserBilling(db, id);
    return res.status(STATUS_CODES.OK).json({ user, ...billing });
}
