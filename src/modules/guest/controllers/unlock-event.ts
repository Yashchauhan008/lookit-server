import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import crypto from 'node:crypto';
import { createJWTToken } from '@/shared/utilities/token.js';
import { TOKEN_TYPES } from '@/modules/auth/auth.constant.js';
import { loadPublicEventBySlug } from '../guest.helpers.js';

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
    // PIN was removed from the guest flow. Accept (and ignore) a legacy
    // `pin` field so older clients don't fail validation.
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

    const event = await loadPublicEventBySlug(db, slug);
    if (!event) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Event not found' });
    }

    // Guest access no longer requires a PIN (share link + consent + selfie
    // is the gate). Any legacy pin_hash on the event is ignored.
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
