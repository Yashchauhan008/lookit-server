import type { NextFunction, Request, Response } from 'express';
import sharp from 'sharp';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import {
    isMediaStorageConfigured,
    mediaStorageNotConfiguredMessage,
    putMediaObject,
} from '@/shared/configs/media-storage.js';
import { publicEventWithBanner, type EventRow } from '../events.helpers.js';

export const ValidationSchema = {
    params: z.object({ id: z.uuid() }),
};

export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    if (!isMediaStorageConfigured()) {
        return res.status(STATUS_CODES.SERVICE_UNAVAILABLE).json({
            message: mediaStorageNotConfiguredMessage(),
            code: 'media_storage_not_configured',
        });
    }
    if (!req.file) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({ message: 'Choose a banner image' });
    }

    const { id } = req.params as z.infer<typeof ValidationSchema.params>;
    const owned = await db.queryOne(
        `SELECT id FROM events WHERE id = $1 AND owner_id = $2 AND status <> 'deleted'`,
        [id, req.user!.id],
    );
    if (!owned) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Event not found' });
    }

    let encoded: Buffer;
    try {
        encoded = await sharp(req.file.buffer)
            .rotate()
            .resize({ width: 2400, height: 800, fit: 'cover', position: 'attention' })
            .webp({ quality: 82 })
            .toBuffer();
    } catch {
        return res.status(STATUS_CODES.BAD_REQUEST).json({ message: 'That image could not be read' });
    }

    const key = `events/${id}/banner-${Date.now()}.webp`;
    await putMediaObject(key, encoded, 'image/webp');

    const row = await db.queryOne<EventRow>(
        `
            UPDATE events
            SET cover_desktop_key = $3, cover_mobile_key = $3, updated_at = now()
            WHERE id = $1 AND owner_id = $2
            RETURNING *, 0 AS photo_count
        `,
        [id, req.user!.id, key],
    );

    return res.status(STATUS_CODES.OK).json({ event: await publicEventWithBanner(row!) });
}
