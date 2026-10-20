import { randomBytes } from 'node:crypto';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { releaseExpiredSessions } from '@/modules/uploads/quota.service.js';

export type PlanRow = {
    id: string;
    code: string;
    name: string;
    kind: 'monthly' | 'season' | 'topup' | 'trial';
    price_inr: number;
    photo_quota: number;
    duration_days: number;
    retention_days: number;
    entitlements: Record<string, unknown>;
    is_active: boolean;
    sort_order: number;
};

export const FREE_PLAN_CODE = 'free_30d';

export const ORDER_KIND: Record<PlanRow['kind'], string> = {
    monthly: 'plan',
    season: 'season',
    topup: 'topup',
    trial: 'trial',
};

export function newRefCode(): string {
    return `LK${randomBytes(4).toString('hex').toUpperCase()}`;
}

export async function findPlanByCode(db: DatabaseClient, code: string) {
    return db.queryOne<PlanRow>('SELECT * FROM plans WHERE code = $1 AND is_active = true', [code]);
}

/** Creates the quota bucket for a plan. Caller owns the transaction. */
export async function activatePlan(
    db: DatabaseClient,
    args: { userId: string; planId: string; orderId: string | null },
) {
    return db.queryOne<{ id: string }>(
        `
            INSERT INTO plan_purchases (
              user_id, plan_id, source_order_id, photo_quota,
              upload_window_end, retention_end, status
            )
            SELECT
              $1, p.id, $3, p.photo_quota,
              now() + make_interval(days => p.duration_days),
              now() + make_interval(days => p.retention_days),
              'active'
            FROM plans p
            WHERE p.id = $2
            RETURNING id
        `,
        [args.userId, args.planId, args.orderId],
    );
}

export async function writeAudit(
    db: DatabaseClient,
    actorId: string,
    action: string,
    targetType: string,
    targetId: string,
    details: Record<string, unknown>,
) {
    await db.query(
        `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [actorId, action, targetType, targetId, JSON.stringify(details)],
    );
}

type PurchaseSummaryRow = {
    id: string;
    status: string;
    photo_quota: number;
    photos_used: number;
    photos_reserved: number;
    upload_window_end: string;
    retention_end: string;
    created_at: string;
    plan_code: string;
    plan_name: string;
    plan_kind: PlanRow['kind'];
    entitlements: Record<string, unknown>;
};

/** Plan + remaining-resource picture for one user (shared by customer and admin views). */
export async function getUserBilling(db: DatabaseClient, userId: string) {
    await releaseExpiredSessions(db, userId);
    const rows = await db.queryAll<PurchaseSummaryRow>(
        `
            SELECT pp.id, pp.status, pp.photo_quota, pp.photos_used, pp.photos_reserved,
                   pp.upload_window_end, pp.retention_end, pp.created_at,
                   p.code AS plan_code, p.name AS plan_name, p.kind AS plan_kind, p.entitlements
            FROM plan_purchases pp
            JOIN plans p ON p.id = pp.plan_id
            WHERE pp.user_id = $1
            ORDER BY pp.created_at DESC
        `,
        [userId],
    );

    const now = Date.now();
    const purchases = rows.map((r) => {
        const windowOpen = new Date(r.upload_window_end).getTime() > now;
        const live = (r.status === 'active' || r.status === 'exhausted') && windowOpen;
        const status = r.status === 'active' && !windowOpen ? 'expired' : r.status;
        return {
            ...r,
            status,
            live,
            remaining: Math.max(0, r.photo_quota - r.photos_used - r.photos_reserved),
        };
    });

    const live = purchases.filter((p) => p.live);
    // A paid plan always outranks the free trial; ties go to whichever ends last.
    const rank = (k: PlanRow['kind']) => (k === 'trial' ? 0 : 1);
    const base = live
        .filter((p) => p.plan_kind !== 'topup')
        .sort(
            (a, b) =>
                rank(b.plan_kind) - rank(a.plan_kind) ||
                +new Date(b.upload_window_end) - +new Date(a.upload_window_end),
        )[0];
    const topups = live.filter((p) => p.plan_kind === 'topup');

    const stats = await db.queryOne<{ events: number; photos: number }>(
        `
            SELECT
              (SELECT COUNT(*)::int FROM events WHERE owner_id = $1 AND status <> 'deleted') AS events,
              (SELECT COUNT(*)::int FROM photos ph JOIN events e ON e.id = ph.event_id WHERE e.owner_id = $1) AS photos
        `,
        [userId],
    );

    const usedFree = await db.queryOne(
        `SELECT 1 FROM plan_purchases pp JOIN plans p ON p.id = pp.plan_id
         WHERE pp.user_id = $1 AND p.code = $2 LIMIT 1`,
        [userId, FREE_PLAN_CODE],
    );

    return {
        free_plan_available: !usedFree,
        current_plan: base
            ? {
                  code: base.plan_code,
                  name: base.plan_name,
                  kind: base.plan_kind,
                  expires_at: base.upload_window_end,
                  retention_end: base.retention_end,
                  entitlements: base.entitlements,
              }
            : null,
        topups: {
            count: topups.length,
            quota: topups.reduce((s, p) => s + p.photo_quota, 0),
            remaining: topups.reduce((s, p) => s + p.remaining, 0),
        },
        totals: {
            quota: live.reduce((s, p) => s + p.photo_quota, 0),
            used: live.reduce((s, p) => s + p.photos_used, 0),
            reserved: live.reduce((s, p) => s + p.photos_reserved, 0),
            remaining: live.reduce((s, p) => s + p.remaining, 0),
        },
        usage: { events: stats?.events ?? 0, photos: stats?.photos ?? 0 },
        purchases,
    };
}
