import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import { requireOwnedEvent } from '../uploads.helpers.js';
import { ensureActivePurchase, reserveQuota } from '../quota.service.js';
import { MAX_FILES_PER_SESSION, UPLOAD_SESSION_TTL_HOURS } from '../uploads.constants.js';
import { isR2Configured } from '@/shared/configs/r2.js';

export const ValidationSchema = {
    params: z.object({
        id: z.uuid(),
    }),
    body: z.object({
        file_count: z.coerce.number().int().min(1).max(MAX_FILES_PER_SESSION),
    }),
};

export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    if (!isR2Configured()) {
        return res.status(STATUS_CODES.SERVICE_UNAVAILABLE).json({
            message:
                'R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET in .env',
            code: 'r2_not_configured',
        });
    }

    const { id: eventId } = req.params as z.infer<typeof ValidationSchema.params>;
    const { file_count } = req.body as z.infer<typeof ValidationSchema.body>;
    const userId = req.user!.id;

    const event = await requireOwnedEvent(db, eventId, userId);
    if (!event) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Event not found' });
    }

    try {
        await db.begin();

        const purchase = await ensureActivePurchase(db, userId);
        const reserved = await reserveQuota(db, purchase.id, file_count);
        if (!reserved) {
            await db.rollback();
            return res.status(402).json({
                message: 'Not enough photo quota remaining',
                code: 'quota_insufficient',
                remaining: purchase.photo_quota - purchase.photos_used - purchase.photos_reserved,
            });
        }

        const session = await db.queryOne(
            `
                INSERT INTO upload_sessions (
                  event_id, purchase_id, user_id,
                  reserved_count, completed_count, status, expires_at
                )
                VALUES (
                  $1, $2, $3, $4, 0, 'open',
                  now() + make_interval(hours => $5)
                )
                RETURNING *
            `,
            [eventId, purchase.id, userId, file_count, UPLOAD_SESSION_TTL_HOURS],
        );

        await db.commit();

        return res.status(STATUS_CODES.CREATED).json({
            session: {
                id: session!.id,
                event_id: session!.event_id,
                reserved_count: session!.reserved_count,
                completed_count: session!.completed_count,
                status: session!.status,
                expires_at: session!.expires_at,
                purchase_id: session!.purchase_id,
                remaining_quota:
                    reserved.photo_quota - reserved.photos_used - reserved.photos_reserved,
            },
        });
    } catch (err: any) {
        await db.rollback();
        if (err?.statusCode) {
            return res.status(err.statusCode).json({
                message: err.message,
                code: err.code,
            });
        }
        throw err;
    }
}
