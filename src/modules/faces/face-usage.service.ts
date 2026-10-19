import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import env from '@/shared/configs/env.js';

export async function assertFaceApiBudget(
    db: DatabaseClient,
    eventId: string | null,
    calls = 1,
): Promise<void> {
    const day = new Date().toISOString().slice(0, 10);

    const global = await db.queryOne<{ calls: number }>(
        `
            SELECT COALESCE(SUM(calls), 0)::int AS calls
            FROM face_api_usage
            WHERE day = $1::date
        `,
        [day],
    );

    if ((global?.calls ?? 0) + calls > env.DAILY_FACE_CALL_CAP) {
        const err = new Error('Daily face API cap reached. Try again tomorrow.');
        (err as Error & { statusCode: number; code: string }).statusCode = 429;
        (err as Error & { code: string }).code = 'face_cap';
        throw err;
    }

    if (eventId) {
        const updated = await db.queryOne(
            `
                UPDATE face_api_usage
                SET calls = calls + $3
                WHERE day = $1::date AND event_id = $2
                RETURNING id
            `,
            [day, eventId, calls],
        );
        if (!updated) {
            await db.query(
                `
                    INSERT INTO face_api_usage (day, event_id, calls)
                    VALUES ($1::date, $2, $3)
                `,
                [day, eventId, calls],
            );
        }
    } else {
        const updated = await db.queryOne(
            `
                UPDATE face_api_usage
                SET calls = calls + $2
                WHERE day = $1::date AND event_id IS NULL
                RETURNING id
            `,
            [day, calls],
        );
        if (!updated) {
            await db.query(
                `
                    INSERT INTO face_api_usage (day, event_id, calls)
                    VALUES ($1::date, NULL, $2)
                `,
                [day, calls],
            );
        }
    }
}
