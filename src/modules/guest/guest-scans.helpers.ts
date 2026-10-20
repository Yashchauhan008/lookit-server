import sharp from 'sharp';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import Logger from '@/shared/configs/logger.js';
import {
    deleteMediaObject,
    isMediaStorageConfigured,
    putMediaObject,
} from '@/shared/configs/media-storage.js';
import { createJWTToken, decodeJWTToken } from '@/shared/utilities/token.js';
import { TOKEN_TYPES } from '@/modules/auth/auth.constant.js';

export type ScanStatus = 'matched' | 'no_match' | 'no_face';

export type ScanRow = {
    id: string;
    event_id: string;
    guest_id: string;
    selfie_key: string | null;
    matched_photo_ids: string[];
    match_count: number;
    status: ScanStatus;
    consent_version: string | null;
    created_at: string;
    deleted_at: string | null;
};

type ScanTokenPayload = {
    type: string;
    scan_id: string;
    event_id: string;
    consent_version: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

/** Long-lived proof of "this device ran this scan", so saved results can be reopened without a new face search. */
export function issueScanToken(scan: { id: string; event_id: string }, consentVersion: string) {
    return createJWTToken(
        {
            type: TOKEN_TYPES.GUEST_SCAN_TOKEN,
            scan_id: scan.id,
            event_id: scan.event_id,
            consent_version: consentVersion,
        },
        '120d',
    );
}

export async function readScanToken(token: unknown): Promise<ScanTokenPayload | null> {
    if (typeof token !== 'string' || !token) return null;
    const payload = await decodeJWTToken<ScanTokenPayload>(token);
    if (!payload || payload.type !== TOKEN_TYPES.GUEST_SCAN_TOKEN || !isUuid(payload.scan_id)) return null;
    return payload;
}

/** Small WebP copy of the selfie for the event owner's gallery. Best-effort: a storage hiccup never fails the search. */
export async function saveSelfie(eventId: string, scanId: string, selfie: Buffer): Promise<string | null> {
    if (!isMediaStorageConfigured()) return null;
    try {
        const webp = await sharp(selfie)
            .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();
        const key = `selfies/${eventId}/${scanId}.webp`;
        await putMediaObject(key, webp, 'image/webp');
        return key;
    } catch (error) {
        Logger.warn(`could not save selfie for scan ${scanId}: ${(error as Error).message}`);
        return null;
    }
}

export async function removeSelfieFile(key: string | null) {
    if (!key) return;
    try {
        await deleteMediaObject(key);
    } catch (error) {
        Logger.warn(`could not delete selfie ${key}: ${(error as Error).message}`);
    }
}

/** A guest keeps one selfie per event: drop the files of their earlier scans when they rescan. */
export async function replacePreviousSelfies(db: DatabaseClient, eventId: string, guestId: string) {
    // RETURNING would give the new (NULL) values, so read the old keys in a CTE first.
    const old = await db.queryAll<{ id: string; selfie_key: string }>(
        `
            WITH prev AS (
              SELECT id, selfie_key FROM guest_scans
              WHERE event_id = $1 AND guest_id = $2 AND selfie_key IS NOT NULL
              FOR UPDATE
            ),
            cleared AS (
              UPDATE guest_scans g SET selfie_key = NULL FROM prev WHERE g.id = prev.id RETURNING g.id
            )
            SELECT prev.id, prev.selfie_key FROM prev
        `,
        [eventId, guestId],
    );
    await Promise.all(old.map((o) => removeSelfieFile(o.selfie_key)));
}
