import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import bcrypt from 'bcryptjs';
import { publicEvent, randomSuffix, slugifyBase, type EventRow } from '../events.helpers.js';

export const ValidationSchema = {
    body: z.object({
        name: z.string().trim().min(1).max(255),
        description: z.string().trim().max(5000).optional().nullable(),
        event_date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional()
            .nullable(),
        visibility: z.enum(['selfie_only', 'full_gallery']).default('selfie_only'),
        pin: z.string().trim().min(4).max(12).optional().nullable(),
        slug: z
            .string()
            .trim()
            .toLowerCase()
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            .min(3)
            .max(64)
            .optional(),
        theme: z.record(z.string(), z.unknown()).optional(),
    }),
};

async function uniqueSlug(db: DatabaseClient, preferred: string): Promise<string> {
    let candidate = preferred;
    for (let i = 0; i < 8; i += 1) {
        const existing = await db.queryOne('SELECT id FROM events WHERE slug = $1', [candidate]);
        if (!existing) return candidate;
        candidate = `${preferred.slice(0, 48)}-${randomSuffix(4)}`;
    }
    return `${preferred.slice(0, 40)}-${randomSuffix(8)}`;
}

export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    const body = req.body as z.infer<typeof ValidationSchema.body>;

    const baseSlug = body.slug || slugifyBase(body.name);
    const slug = await uniqueSlug(db, baseSlug);
    const pinHash = body.pin ? await bcrypt.hash(body.pin, 10) : null;

    const row = await db.queryOne<EventRow>(
        `
            INSERT INTO events (
              owner_id, slug, name, description, event_date,
              visibility, pin_hash, theme, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'active')
            RETURNING *, 0 AS photo_count
        `,
        [
            req.user!.id,
            slug,
            body.name,
            body.description ?? null,
            body.event_date ?? null,
            body.visibility,
            pinHash,
            JSON.stringify(body.theme ?? {}),
        ],
    );

    return res.status(STATUS_CODES.CREATED).json({
        event: publicEvent(row!),
    });
}
