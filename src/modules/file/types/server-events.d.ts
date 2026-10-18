/**
 * File module server events. Merged into global ServerEvents (no import in central types).
 */

declare global {
    interface ServerEvents {
        'file:registered': (file: { id: string; key: string; _status: string }) => void;
        'file:saved': (file: { id: string; key: string; _status: string }) => void;
        'file:deleted': (file: { id: string }) => void;
    }
}

export {};
