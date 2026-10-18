import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';

export const ValidationSchema = {
    params: z.object({
        slug: z
            .string()
            .trim()
            .toLowerCase()
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            .min(3)
            .max(64),
    }),
};

export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    const { slug } = req.params as z.infer<typeof ValidationSchema.params>;

    const row = await db.queryOne<{
        id: string;
        slug: string;
        name: string;
        description: string | null;
        event_date: string | null;
        visibility: string;
        pin_hash: string | null;
        theme: Record<string, unknown>;
        cover_desktop_key: string | null;
        cover_mobile_key: string | null;
        studio_name: string | null;
        owner_name: string;
    }>(
        `
            SELECT e.id, e.slug, e.name, e.description, e.event_date, e.visibility,
                   e.pin_hash, e.theme, e.cover_desktop_key, e.cover_mobile_key,
                   u.studio_name, u.name AS owner_name
            FROM events e
            JOIN users u ON u.id = e.owner_id
            WHERE e.slug = $1
              AND e.status = 'active'
              AND u.status = 'active'
        `,
        [slug],
    );

    if (!row) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Event not found' });
    }

    return res.status(STATUS_CODES.OK).json({
        event: {
            id: row.id,
            slug: row.slug,
            name: row.name,
            description: row.description,
            event_date: row.event_date,
            visibility: row.visibility,
            theme: row.theme ?? {},
            cover_desktop_key: row.cover_desktop_key,
            cover_mobile_key: row.cover_mobile_key,
            needs_pin: Boolean(row.pin_hash),
            studio: {
                name: row.studio_name || row.owner_name,
            },
        },
    });
}
