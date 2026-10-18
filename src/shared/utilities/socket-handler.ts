import { Server, Socket } from 'socket.io';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { z } from 'zod';
import { validate } from '@/shared/helpers/validation.helper.js';
import Database from '@/shared/helpers/database.helper.js';

export type SocketCallback = ((response: unknown) => void) | undefined;

export type Context = {
    io: Server;
    socket: Socket;
    database?: DatabaseClient;
};

export type SocketEventHandler = (
    ctx: Context,
    payload: any | undefined,
    callback: SocketCallback,
) => Promise<void>;

type HandleSocketHandlerOptions = {
    withDatabase?: boolean;
};

function sendError(
    socket: Socket,
    callback: SocketCallback,
    code: string,
    message: string,
    details?: any,
): void {
    const errorPayload = {
        success: false,
        code,
        message,
        details,
    };

    if (typeof callback === 'function') {
        callback(errorPayload);
    } else {
        socket.emit('server_error', errorPayload);
    }
}

export default function registerSocketEventHandler({
    io,
    socket,
    schema,
    handler,
    options = { withDatabase: false },
}: {
    io: Server;
    socket: Socket;
    schema?: z.ZodSchema;
    handler: SocketEventHandler;
    options?: HandleSocketHandlerOptions;
}) {
    return async (payload: any, callback: SocketCallback) => {
        let validatedData = payload;

        if (schema) {
            try {
                validatedData = validate(schema, payload);
            } catch (error) {
                return sendError(
                    socket,
                    callback,
                    'validation_error',
                    error.message,
                    error.details,
                );
            }
        }

        try {
            if (options.withDatabase) {
                const db = await Database.getConnection();
                try {
                    await handler({ io, socket, database: db }, validatedData, callback);
                } finally {
                    db.release();
                }
            } else {
                await handler({ io, socket, database: null }, validatedData, callback);
            }
        } catch (error) {
            return sendError(socket, callback, 'error', error.message, error.stack);
        }
    };
}
