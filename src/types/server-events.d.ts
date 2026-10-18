/**
 * Base server events. Extend from any module by adding another .d.ts with
 * declare global { interface ServerEvents { ... } } — no imports needed.
 */
declare global {
    interface ServerEvents {
        error: (error: Error) => void;
    }
}

export {};
