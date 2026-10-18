import Logger from '@/shared/configs/logger.js';
import type { Context } from '@/shared/utilities/socket-handler.js';

export async function Handler({ io, socket }: Context) {
    const userId = socket.data.user!.id;

    Logger.info(`User disconnected: ${userId} (socket: ${socket.id})`);

    const remaining = await io.in(userId).fetchSockets();

    if (remaining.length === 1) {
        socket.rooms.forEach((room) => {
            if (room !== userId) {
                socket.to(room).emit('user:offline', { user_id: userId });
            }
        });
    }
}
