import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import type { PlanRow } from '../billing.helpers.js';

export async function Controller(
    _req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    const plans = await db.queryAll<PlanRow>(
        `SELECT * FROM plans WHERE is_active = true ORDER BY sort_order ASC`,
    );
    const upi = await db.queryOne<{ value: Record<string, unknown> }>(
        `SELECT value FROM settings WHERE key = 'upi'`,
    );

    return res.status(STATUS_CODES.OK).json({ plans, upi: upi?.value ?? null });
}
