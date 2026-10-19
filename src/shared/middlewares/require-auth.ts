import type { NextFunction, Request, Response } from 'express';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import { decodeJWTToken } from '@/shared/utilities/token.js';
import withDatabase from '@/shared/utilities/with-database.js';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { TOKEN_TYPES } from '@/modules/auth/auth.constant.js';

type AccessTokenPayload = {
    type?: string;
    user_id?: string;
    role?: string;
};

async function requireAuthHandler(
    req: Request,
    res: Response,
    next: NextFunction,
    db: DatabaseClient,
) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return res.status(STATUS_CODES.UNAUTHORIZED).json({ message: 'Unauthorized' });
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
        return res.status(STATUS_CODES.UNAUTHORIZED).json({ message: 'Unauthorized' });
    }

    const payload = await decodeJWTToken<AccessTokenPayload>(token);
    if (!payload || payload.type !== TOKEN_TYPES.USER_ACCESS_TOKEN || !payload.user_id) {
        return res.status(STATUS_CODES.UNAUTHORIZED).json({ message: 'Unauthorized' });
    }

    const user = await db.queryOne<{
        id: string;
        email: string;
        name: string;
        role: 'photographer' | 'admin';
        status: 'active' | 'suspended';
        studio_name: string | null;
    }>(
        `
            SELECT id, email, name, role, status, studio_name
            FROM users
            WHERE id = $1
        `,
        [payload.user_id],
    );

    if (!user) {
        return res.status(STATUS_CODES.UNAUTHORIZED).json({ message: 'Unauthorized' });
    }

    if (user.status === 'suspended') {
        return res.status(STATUS_CODES.FORBIDDEN).json({ message: 'Account suspended' });
    }

    req.user = user;
    return next();
}

/** Authenticated photographer/admin. Loads fresh user row (role + suspension). */
export const requireAuth = withDatabase(requireAuthHandler);

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.user) {
        return res.status(STATUS_CODES.UNAUTHORIZED).json({ message: 'Unauthorized' });
    }
    if (req.user.role !== 'admin') {
        return res.status(STATUS_CODES.FORBIDDEN).json({ message: 'Admin only' });
    }
    return next();
}
