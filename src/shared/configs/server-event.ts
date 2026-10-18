import { EventEmitter } from 'events';

type TypedEmitter<T extends { [K in keyof T]: (...args: any[]) => void }> = {
    on<K extends keyof T>(event: K, listener: T[K]): TypedEmitter<T>;
    off<K extends keyof T>(event: K, listener: T[K]): TypedEmitter<T>;
    once<K extends keyof T>(event: K, listener: T[K]): TypedEmitter<T>;
    emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): boolean;
    removeAllListeners<K extends keyof T>(event?: K): TypedEmitter<T>;
};

const eventEmitter: TypedEmitter<ServerEvents> = new EventEmitter();

export default eventEmitter;
