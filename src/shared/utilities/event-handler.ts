import Database, { type DatabaseClient } from '@/shared/helpers/database.helper.js';
import eventEmitter from '@/shared/configs/server-event.js';


export type Options = {
    withDatabase: boolean;
} | undefined;

export type EventContext = {
    database?: DatabaseClient;
};

export type Handler<TArgs extends any[], TResult> = (
    context: EventContext,
    ...args: TArgs
) => Promise<TResult>;

export default function RegisterServerEventHandler<TArgs extends any[], TResult>(
    handler: Handler<TArgs, TResult>,
    options: Options = { withDatabase: false }
): (...args: TArgs) => void {

    return (async (...args: TArgs): Promise<TResult> => {
        if (options.withDatabase) {
            const database = await Database.getConnection();
            try {
                return await handler({ database }, ...args);
            } catch (error) {
                eventEmitter.emit('error', error);
            } finally {
                database.release();
            }
        } else {
            try {
                return await handler({}, ...args);
            } catch (error) {
                eventEmitter.emit('error', error);
            }
        }
    });
}
