import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import { signedGetUrl } from '@/shared/configs/media-storage.js';
import { getGuestMatches, loadPublicEventBySlug } from '../guest.helpers.js';

export const ValidationSchema = {
    params: z.object({
        slug: z
            .string()
            .trim()
            .toLowerCase()
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            .min(3)
            .max(64),
        photoId: z.uuid(),
    }),
    query: z.object({
        variant: z.enum(['thumb', 'preview', 'orig']).default('preview'),
    }),
};

export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    const { slug, photoId } = req.params as z.infer<typeof ValidationSchema.params>;
    const query = (req as Request & { validatedQuery?: z.infer<typeof ValidationSchema.query> })
        .validatedQuery ||
        (req.query as unknown as z.infer<typeof ValidationSchema.query>);
    const guest = req.guest!;

    const event = await loadPublicEventBySlug(db, slug);
    if (!event || event.id !== guest.event_id) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Event not found' });
    }

    const allowed = await getGuestMatches(guest.jti, event.id);
    if (!allowed.includes(photoId)) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Photo not found' });
    }

    const photo = await db.queryOne<{
        thumb_key: string | null;
        prev_key: string | null;
        orig_key: string | null;
        original_filename: string | null;
    }>(
        `
            SELECT thumb_key, prev_key, orig_key, original_filename
            FROM photos
            WHERE id = $1 AND event_id = $2
        `,
        [photoId, event.id],
    );
    if (!photo) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Photo not found' });
    }

    const key =
        query.variant === 'thumb'
            ? photo.thumb_key || photo.prev_key || photo.orig_key
            : query.variant === 'orig'
              ? photo.orig_key || photo.prev_key
              : photo.prev_key || photo.orig_key;

    if (!key) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Photo file missing' });
    }

    const url = await signedGetUrl(key, 900);
    return res.status(STATUS_CODES.OK).json({
        url,
        expires_in: 900,
        filename: photo.original_filename,
    });
}
