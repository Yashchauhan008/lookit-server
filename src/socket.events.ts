import Logger from '@/shared/configs/logger.js';
import type { Context as SocketContext } from '@/shared/utilities/socket-handler.js';

import registerSocketEventHandler from '@/shared/utilities/socket-handler.js';
import { Handler as onUserDisconnectHandler } from '@/modules/user/handlers/socket/on-user-disconnect.js';

export default async function Handler({ io, socket }: SocketContext) {
    const user = socket.data.user;
    if (!user) return;

    const userId: string = user.id;

    Logger.info(`User connected: ${userId} (socket: ${socket.id})`);

    const sockets = await io.in(userId).fetchSockets();
    if (sockets.length === 1) {
        socket.rooms.forEach((room) => {
            if (room !== userId) {
                socket.to(room).emit('user:online', { user_id: userId });
            }
        });
    }

    socket.on('ping', (message: string) => {
        socket.emit('pong', message);
    });

    socket.on(
        'disconnect',
        registerSocketEventHandler({
            io,
            socket,
            handler: onUserDisconnectHandler,
        }),
    );
}
