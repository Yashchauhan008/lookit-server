import ServerError from '@/shared/utilities/server-error.class.js';
import { decodeJWTToken } from '@/shared/utilities/token.js';
import { Socket } from 'socket.io';
import { TOKEN_TYPES } from '../auth.constant.js';

export default async function validateUserSocketHandShake(
    socket: Socket,
    next: (err?: Error) => void,
) {
    try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization;

        if (!token) throw new ServerError('UNAUTHORIZED', 'token is required');
        if (!token.startsWith('Bearer ')) throw new ServerError('UNAUTHORIZED', 'invalid token');

        const tokenString = token.split(' ')[1];
        if (!tokenString) throw new ServerError('UNAUTHORIZED', 'token is required');

        const payload = await decodeJWTToken(tokenString);
        if (!payload || payload.type !== TOKEN_TYPES.USER_ACCESS_TOKEN)
            throw new ServerError('UNAUTHORIZED', 'invalid token');

        socket.join(payload.user_id as string);

        next();
    } catch (error) {
        next(error);
    }
}
