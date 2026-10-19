import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import { getConsentVersion, loadPublicEventBySlug } from '../guest.helpers.js';

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
    const event = await loadPublicEventBySlug(db, slug);
    if (!event) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Event not found' });
    }

    const row = await db.queryOne<{
        value: { current_version?: string; text_en?: string };
    }>(`SELECT value FROM settings WHERE key = 'consent'`);

    return res.status(STATUS_CODES.OK).json({
        consent: {
            version: row?.value?.current_version || (await getConsentVersion(db)),
            text:
                row?.value?.text_en ||
                'We use your selfie only to find photos of you in this event. The selfie is processed in memory and never stored.',
        },
    });
}
