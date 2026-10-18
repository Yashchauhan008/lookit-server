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

/** Active purchase with remaining quota, or auto-grant trial_7d once. */
export async function ensureActivePurchase(
    db: DatabaseClient,
    userId: string,
): Promise<PurchaseRow> {
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
            WHERE pp.user_id = $1 AND p.code = 'trial_7d'
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
            WHERE p.code = 'trial_7d' AND p.is_active = true
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
