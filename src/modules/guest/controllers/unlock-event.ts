import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { createJWTToken } from '@/shared/utilities/token.js';
import { TOKEN_TYPES } from '@/modules/auth/auth.constant.js';
import {
    assertPinNotLocked,
    clearPinFailures,
    hashIp,
    loadPublicEventBySlug,
    recordPinFailure,
} from '../guest.helpers.js';

export const ValidationSchema = {
    params: z.object({
        slug: z
            .string()
            .trim()
            .toLowerCase()
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            .min(3)
            .max(64),
    }),
    body: z.object({
        pin: z.string().trim().min(4).max(12).optional().nullable(),
    }),
};

export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    const { slug } = req.params as z.infer<typeof ValidationSchema.params>;
    const body = req.body as z.infer<typeof ValidationSchema.body>;
    const ipHash = hashIp(req.ip);

    const event = await loadPublicEventBySlug(db, slug);
    if (!event) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Event not found' });
    }

    try {
        await assertPinNotLocked(event.id, ipHash);
    } catch (err: any) {
        return res.status(err.statusCode || 429).json({ message: err.message, code: err.code });
    }

    if (event.pin_hash) {
        if (!body.pin) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({
                message: 'PIN required',
                code: 'pin_required',
            });
        }
        const ok = await bcrypt.compare(body.pin, event.pin_hash);
        if (!ok) {
            await recordPinFailure(event.id, ipHash);
            return res.status(STATUS_CODES.UNAUTHORIZED).json({
                message: 'Incorrect PIN',
                code: 'bad_pin',
            });
        }
        await clearPinFailures(event.id, ipHash);
    }

    const jti = crypto.randomUUID();
    const token = await createJWTToken(
        {
            type: TOKEN_TYPES.GUEST_EVENT_TOKEN,
            event_id: event.id,
            consent: false,
            jti,
        },
        '2h',
    );

    return res.status(STATUS_CODES.OK).json({
        token,
        event_id: event.id,
        needs_consent: true,
    });
}
