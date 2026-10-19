import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import crypto from 'node:crypto';
import RedisClient from '@/shared/configs/redis.js';

export type PublicEventRow = {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    event_date: string | null;
    visibility: string;
    pin_hash: string | null;
    theme: Record<string, unknown>;
    face_collection_id: string | null;
    studio_name: string | null;
    owner_name: string;
};

export async function loadPublicEventBySlug(
    db: DatabaseClient,
    slug: string,
): Promise<PublicEventRow | null> {
    return db.queryOne<PublicEventRow>(
        `
            SELECT e.id, e.slug, e.name, e.description, e.event_date, e.visibility,
                   e.pin_hash, e.theme, e.face_collection_id,
                   u.studio_name, u.name AS owner_name
            FROM events e
            JOIN users u ON u.id = e.owner_id
            WHERE e.slug = $1
              AND e.status = 'active'
              AND u.status = 'active'
        `,
        [slug],
    );
}

export function hashIp(ip: string | undefined): string {
    const raw = ip || 'unknown';
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

const PIN_LOCK_TTL_SEC = 15 * 60;
const PIN_MAX_ATTEMPTS = 5;

export async function assertPinNotLocked(eventId: string, ipHash: string): Promise<void> {
    if (!RedisClient.isOpen) return;
    const key = `guest:pinlock:${eventId}:${ipHash}`;
    const n = Number((await RedisClient.get(key)) || 0);
    if (n >= PIN_MAX_ATTEMPTS) {
        const err = new Error('Too many PIN attempts. Try again in 15 minutes.');
        (err as Error & { statusCode: number; code: string }).statusCode = 429;
        (err as Error & { code: string }).code = 'pin_locked';
        throw err;
    }
}

export async function recordPinFailure(eventId: string, ipHash: string): Promise<void> {
    if (!RedisClient.isOpen) return;
    const key = `guest:pinlock:${eventId}:${ipHash}`;
    const n = await RedisClient.incr(key);
    if (n === 1) await RedisClient.expire(key, PIN_LOCK_TTL_SEC);
}

export async function clearPinFailures(eventId: string, ipHash: string): Promise<void> {
    if (!RedisClient.isOpen) return;
    await RedisClient.del(`guest:pinlock:${eventId}:${ipHash}`);
}

export async function storeGuestMatches(
    jti: string,
    eventId: string,
    photoIds: string[],
): Promise<void> {
    if (!RedisClient.isOpen) return;
    const key = `guest:matches:${eventId}:${jti}`;
    await RedisClient.set(key, JSON.stringify(photoIds), { EX: 2 * 60 * 60 });
}

export async function getGuestMatches(
    jti: string,
    eventId: string,
): Promise<string[]> {
    if (!RedisClient.isOpen) return [];
    const raw = await RedisClient.get(`guest:matches:${eventId}:${jti}`);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(String(raw)) as string[];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export async function getConsentVersion(db: DatabaseClient): Promise<string> {
    const row = await db.queryOne<{ value: { current_version?: string } }>(
        `SELECT value FROM settings WHERE key = 'consent'`,
    );
    return row?.value?.current_version || '2026-10-18';
}
