import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import { AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { requireOwnedEvent, type PhotoRow } from '../uploads.helpers.js';
import { releaseReserved } from '../quota.service.js';
import {
    isMediaStorageConfigured,
    mediaS3,
    MEDIA_BUCKET,
} from '@/shared/configs/media-storage.js';

export const ValidationSchema = {
    params: z.object({
        id: z.uuid(),
        photoId: z.uuid(),
    }),
    body: z.object({
        upload_id: z.string().min(1).optional(),
    }),
};

export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    const { id: eventId, photoId } = req.params as z.infer<typeof ValidationSchema.params>;
    const body = (req.body || {}) as { upload_id?: string };
    const userId = req.user!.id;

    const event = await requireOwnedEvent(db, eventId, userId);
    if (!event) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Event not found' });
    }

    const photo = await db.queryOne<PhotoRow>(
        `
            SELECT *
            FROM photos
            WHERE id = $1
              AND event_id = $2
              AND status = 'uploading'
        `,
        [photoId, eventId],
    );
    if (!photo) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Photo upload not found' });
    }

    if (isMediaStorageConfigured() && photo.orig_key && photo.multipart_upload_id) {
        try {
            await mediaS3.send(
                new AbortMultipartUploadCommand({
                    Bucket: MEDIA_BUCKET,
                    Key: photo.orig_key,
                    UploadId: body.upload_id || photo.multipart_upload_id,
                }),
            );
        } catch {
            /* already aborted / completed */
        }
    }

    await db.begin();
    try {
        await db.query(
            `
                UPDATE photos
                SET status = 'failed',
                    error = 'aborted',
                    multipart_upload_id = NULL,
                    updated_at = now()
                WHERE id = $1
            `,
            [photoId],
        );

        await releaseReserved(db, photo.purchase_id, 1);

        if (photo.upload_session_id) {
            await db.query(
                `
                    UPDATE upload_sessions
                    SET reserved_count = GREATEST(0, reserved_count - 1),
                        updated_at = now()
                    WHERE id = $1
                      AND status = 'open'
                `,
                [photo.upload_session_id],
            );
        }

        await db.commit();
    } catch (err) {
        await db.rollback();
        throw err;
    }

    return res.status(STATUS_CODES.OK).json({ message: 'Upload aborted' });
}
