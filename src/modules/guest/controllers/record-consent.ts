import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import crypto from 'node:crypto';
import { createJWTToken } from '@/shared/utilities/token.js';
import { TOKEN_TYPES } from '@/modules/auth/auth.constant.js';
import {
    getConsentVersion,
    hashIp,
    loadPublicEventBySlug,
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
        accepted: z.literal(true),
    }),
};

export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    const { slug } = req.params as z.infer<typeof ValidationSchema.params>;
    const guest = req.guest!;

    const event = await loadPublicEventBySlug(db, slug);
    if (!event || event.id !== guest.event_id) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Event not found' });
    }

    const version = await getConsentVersion(db);
    await db.query(
        `
            INSERT INTO guest_consents (event_id, consent_version, ip_hash)
            VALUES ($1, $2, $3)
        `,
        [event.id, version, hashIp(req.ip)],
    );

    const jti = guest.jti && guest.jti !== 'legacy' ? guest.jti : crypto.randomUUID();
    const token = await createJWTToken(
        {
            type: TOKEN_TYPES.GUEST_EVENT_TOKEN,
            event_id: event.id,
            consent: true,
            jti,
        },
        '2h',
    );

    return res.status(STATUS_CODES.OK).json({
        token,
        consent_version: version,
    });
}
