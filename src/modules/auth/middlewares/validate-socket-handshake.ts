import ServerError from '@/shared/utilities/server-error.class.js';
import { decodeJWTToken } from '@/shared/utilities/token.js';
import { Socket } from 'socket.io';
import { TOKEN_TYPES } from '../auth.constant.js';
import Database from '@/shared/helpers/database.helper.js';

type AccessTokenPayload = {
    type?: string;
    user_id?: string;
};

export default async function validateUserSocketHandShake(
    socket: Socket,
    next: (err?: Error) => void,
) {
    try {
        const raw =
            (typeof socket.handshake.auth?.token === 'string' && socket.handshake.auth.token) ||
            (typeof socket.handshake.headers.authorization === 'string' &&
                socket.handshake.headers.authorization) ||
            '';

        if (!raw) throw new ServerError('UNAUTHORIZED', 'token is required');

        const tokenString = raw.startsWith('Bearer ') ? raw.slice('Bearer '.length).trim() : raw.trim();
        if (!tokenString) throw new ServerError('UNAUTHORIZED', 'token is required');

        const payload = await decodeJWTToken<AccessTokenPayload>(tokenString);
        if (!payload || payload.type !== TOKEN_TYPES.USER_ACCESS_TOKEN || !payload.user_id) {
            throw new ServerError('UNAUTHORIZED', 'invalid token');
        }

        const db = await Database.getConnection();
        try {
            const user = await db.queryOne<{ status: string }>(
                'SELECT status FROM users WHERE id = $1',
                [payload.user_id],
            );
            if (!user) throw new ServerError('UNAUTHORIZED', 'invalid token');
            if (user.status === 'suspended') {
                throw new ServerError('FORBIDDEN', 'Account suspended');
            }
        } finally {
            db.release();
        }

        socket.data.userId = payload.user_id;
        socket.join(payload.user_id);

        next();
    } catch (error) {
        next(error instanceof Error ? error : new Error('Unauthorized'));
    }
}
