import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import { ListPartsCommand } from '@aws-sdk/client-s3';
import { requireOwnedEvent, type PhotoRow } from '../uploads.helpers.js';
import {
    isMediaStorageConfigured,
    mediaS3,
    MEDIA_BUCKET,
    mediaStorageNotConfiguredMessage,
} from '@/shared/configs/media-storage.js';

export const ValidationSchema = {
    params: z.object({
        id: z.uuid(),
        photoId: z.uuid(),
    }),
    query: z.object({
        upload_id: z.string().min(1).optional(),
    }),
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

    const { id: eventId, photoId } = req.params as z.infer<typeof ValidationSchema.params>;
    const query = req.query as unknown as z.infer<typeof ValidationSchema.query>;
    const userId = req.user!.id;

    const event = await requireOwnedEvent(db, eventId, userId);
    if (!event) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Event not found' });
    }

    const photo = await db.queryOne<PhotoRow>(
        `
            SELECT *
            FROM photos
            WHERE id = $1 AND event_id = $2 AND status = 'uploading'
        `,
        [photoId, eventId],
    );
    if (!photo || !photo.orig_key || !photo.multipart_upload_id) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Photo upload not found' });
    }

    const result = await mediaS3.send(
        new ListPartsCommand({
            Bucket: MEDIA_BUCKET,
            Key: photo.orig_key,
            UploadId: query.upload_id || photo.multipart_upload_id,
        }),
    );

    return res.status(STATUS_CODES.OK).json({
        parts: (result.Parts || []).map((p) => ({
            PartNumber: p.PartNumber,
            ETag: p.ETag,
            Size: p.Size,
        })),
    });
}
