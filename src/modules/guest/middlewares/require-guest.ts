import type { NextFunction, Request, Response } from 'express';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import { decodeJWTToken } from '@/shared/utilities/token.js';
import { TOKEN_TYPES } from '@/modules/auth/auth.constant.js';

type GuestPayload = {
    type: string;
    event_id: string;
    consent?: boolean;
    jti?: string;
};

export async function requireGuest(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return res.status(STATUS_CODES.UNAUTHORIZED).json({ message: 'Guest token required' });
    }

    const token = header.slice(7);
    const payload = await decodeJWTToken<GuestPayload>(token);
    if (!payload || payload.type !== TOKEN_TYPES.GUEST_EVENT_TOKEN || !payload.event_id) {
        return res.status(STATUS_CODES.UNAUTHORIZED).json({ message: 'Invalid guest token' });
    }

    req.guest = {
        event_id: payload.event_id,
        consent: Boolean(payload.consent),
        jti: payload.jti || 'legacy',
    };
    return next();
}

export function requireGuestConsent(req: Request, res: Response, next: NextFunction) {
    if (!req.guest?.consent) {
        return res.status(STATUS_CODES.FORBIDDEN).json({
            message: 'Consent required before search',
            code: 'consent_required',
        });
    }
    return next();
}
