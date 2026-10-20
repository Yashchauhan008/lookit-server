import type { DatabaseClient } from '@/shared/helpers/database.helper.js';

export type PurchaseRow = {
    id: string;
    user_id: string;
    plan_id: string;
    photo_quota: number;
    photos_used: number;
    photos_reserved: number;
    upload_window_end: string;
    retention_end: string;
    status: string;
};

/** Active purchase with remaining quota, or auto-grant free_30d once. */
export async function ensureActivePurchase(
    db: DatabaseClient,
    userId: string,
): Promise<PurchaseRow> {
    await releaseExpiredSessions(db, userId);

    const existing = await db.queryOne<PurchaseRow>(
        `
            SELECT *
            FROM plan_purchases
            WHERE user_id = $1
              AND status = 'active'
              AND upload_window_end > now()
              AND photos_used + photos_reserved < photo_quota
            ORDER BY created_at ASC
            LIMIT 1
            FOR UPDATE
        `,
        [userId],
    );
    if (existing) return existing;

    const hadTrial = await db.queryOne<{ id: string }>(
        `
            SELECT pp.id
            FROM plan_purchases pp
            JOIN plans p ON p.id = pp.plan_id
            WHERE pp.user_id = $1 AND p.code = 'free_30d'
            LIMIT 1
        `,
        [userId],
    );

    if (hadTrial) {
        throw Object.assign(new Error('No active photo quota. Purchase a plan to continue.'), {
            statusCode: 402,
            code: 'quota_exhausted',
        });
    }

    const granted = await db.queryOne<PurchaseRow>(
        `
            INSERT INTO plan_purchases (
              user_id, plan_id, photo_quota,
              upload_window_end, retention_end, status
            )
            SELECT
              $1,
              p.id,
              p.photo_quota,
              now() + make_interval(days => p.duration_days),
              now() + make_interval(days => p.retention_days),
              'active'
            FROM plans p
            WHERE p.code = 'free_30d' AND p.is_active = true
            RETURNING *
        `,
        [userId],
    );

    if (!granted) {
        throw Object.assign(new Error('Trial plan is not available'), {
            statusCode: 500,
            code: 'trial_missing',
        });
    }

    return granted;
}

export async function reserveQuota(
    db: DatabaseClient,
    purchaseId: string,
    count: number,
): Promise<PurchaseRow | null> {
    return db.queryOne<PurchaseRow>(
        `
            UPDATE plan_purchases
            SET photos_reserved = photos_reserved + $2,
                updated_at = now()
            WHERE id = $1
              AND status = 'active'
              AND upload_window_end > now()
              AND photos_used + photos_reserved + $2 <= photo_quota
            RETURNING *
        `,
        [purchaseId, count],
    );
}

export async function convertReservedToUsed(
    db: DatabaseClient,
    purchaseId: string,
    count = 1,
): Promise<void> {
    await db.query(
        `
            UPDATE plan_purchases
            SET photos_reserved = photos_reserved - $2,
                photos_used = photos_used + $2,
                updated_at = now(),
                status = CASE
                  WHEN photos_used + $2 >= photo_quota THEN 'exhausted'
                  ELSE status
                END
            WHERE id = $1
              AND photos_reserved >= $2
        `,
        [purchaseId, count],
    );
}

export async function releaseReserved(
    db: DatabaseClient,
    purchaseId: string,
    count: number,
): Promise<void> {
    if (count <= 0) return;
    await db.query(
        `
            UPDATE plan_purchases
            SET photos_reserved = GREATEST(0, photos_reserved - $2),
                updated_at = now(),
                status = CASE
                  WHEN status = 'exhausted'
                       AND photos_used + GREATEST(0, photos_reserved - $2) < photo_quota
                       AND upload_window_end > now()
                  THEN 'active'
                  ELSE status
                END
            WHERE id = $1
        `,
        [purchaseId, count],
    );
}

/**
 * Upload sessions that expired while still open never gave their reserved photos back.
 * Expire them and return the unfinished part of each reservation to its pack.
 * Pass a userId to scope the sweep; omit it to sweep everyone.
 */
export async function releaseExpiredSessions(db: DatabaseClient, userId?: string): Promise<void> {
    await db.query(
        `
            WITH stale AS (
              SELECT id, purchase_id, reserved_count - completed_count AS unused
              FROM upload_sessions
              WHERE status = 'open'
                AND expires_at < now()
                AND ($1::uuid IS NULL OR user_id = $1)
              FOR UPDATE
            ),
            mark AS (
              UPDATE upload_sessions s
              SET status = 'expired', reserved_count = s.completed_count, updated_at = now()
              FROM stale
              WHERE s.id = stale.id
              RETURNING s.id
            ),
            failed AS (
              UPDATE photos
              SET status = 'failed', error = 'session_expired',
                  multipart_upload_id = NULL, updated_at = now()
              WHERE upload_session_id IN (SELECT id FROM stale) AND status = 'uploading'
              RETURNING id
            ),
            per AS (
              SELECT purchase_id, SUM(unused)::int AS n FROM stale GROUP BY purchase_id
            )
            UPDATE plan_purchases pp
            SET photos_reserved = GREATEST(0, pp.photos_reserved - per.n),
                updated_at = now(),
                status = CASE
                  WHEN pp.status = 'exhausted'
                       AND pp.photos_used + GREATEST(0, pp.photos_reserved - per.n) < pp.photo_quota
                       AND pp.upload_window_end > now()
                  THEN 'active'
                  ELSE pp.status
                END
            FROM per
            WHERE pp.id = per.purchase_id
        `,
        [userId ?? null],
    );
}
