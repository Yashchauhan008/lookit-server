import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import bcrypt from 'bcryptjs';
import { publicEventWithBanner, type EventRow } from '../events.helpers.js';

export const ValidationSchema = {
    params: z.object({
        id: z.uuid(),
    }),
    body: z.object({
        name: z.string().trim().min(1).max(255).optional(),
        description: z.string().trim().max(5000).optional().nullable(),
        event_date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional()
            .nullable(),
        end_date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional()
            .nullable(),
        visibility: z.enum(['selfie_only', 'full_gallery']).optional(),
        pin: z.string().trim().min(4).max(12).optional().nullable(),
        clear_pin: z.boolean().optional(),
        theme: z.record(z.string(), z.unknown()).optional(),
        status: z.enum(['active', 'hidden']).optional(),
    }),
};

export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    const { id } = req.params as z.infer<typeof ValidationSchema.params>;
    const body = req.body as z.infer<typeof ValidationSchema.body>;

    const existing = await db.queryOne<EventRow>(
        `
            SELECT * FROM events
            WHERE id = $1 AND owner_id = $2 AND status <> 'deleted'
        `,
        [id, req.user!.id],
    );

    if (!existing) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Event not found' });
    }

    const start = body.event_date !== undefined ? body.event_date : existing.event_date;
    const end = body.end_date !== undefined ? body.end_date : existing.end_date;
    if (start && end && String(end).slice(0, 10) < String(start).slice(0, 10)) {
        return res
            .status(STATUS_CODES.BAD_REQUEST)
            .json({ message: 'End date must be on or after the start date' });
    }

    let pinHash = existing.pin_hash;
    if (body.clear_pin) pinHash = null;
    else if (body.pin) pinHash = await bcrypt.hash(body.pin, 10);

    const row = await db.queryOne<EventRow>(
        `
            UPDATE events SET
              name = COALESCE($3, name),
              description = CASE WHEN $4::boolean THEN $5 ELSE description END,
              event_date = CASE WHEN $6::boolean THEN $7::date ELSE event_date END,
              end_date = CASE WHEN $12::boolean THEN $13::date ELSE end_date END,
              visibility = COALESCE($8, visibility),
              pin_hash = $9,
              theme = COALESCE($10::jsonb, theme),
              status = COALESCE($11, status),
              updated_at = now()
            WHERE id = $1 AND owner_id = $2
            RETURNING *,
              COALESCE(
                (SELECT COUNT(*)::int FROM photos p WHERE p.event_id = events.id),
                0
              ) AS photo_count
        `,
        [
            id,
            req.user!.id,
            body.name ?? null,
            body.description !== undefined,
            body.description ?? null,
            body.event_date !== undefined,
            body.event_date ?? null,
            body.visibility ?? null,
            pinHash,
            body.theme !== undefined ? JSON.stringify(body.theme) : null,
            body.status ?? null,
            body.end_date !== undefined,
            body.end_date ?? null,
        ],
    );

    return res.status(STATUS_CODES.OK).json({
        event: await publicEventWithBanner(row!),
    });
}
