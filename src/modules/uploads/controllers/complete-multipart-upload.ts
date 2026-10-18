import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import {
    CompleteMultipartUploadCommand,
    HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { requireOwnedEvent, publicPhoto, type PhotoRow } from '../uploads.helpers.js';
import { convertReservedToUsed } from '../quota.service.js';
import { isR2Configured, r2, R2_BUCKET } from '@/shared/configs/r2.js';
import { enqueueProcessPhoto } from '../queues/process-photo.queue.js';
import { MAX_PHOTO_BYTES } from '../uploads.constants.js';

export const ValidationSchema = {
    params: z.object({
        id: z.uuid(),
        photoId: z.uuid(),
    }),
    body: z.object({
        upload_id: z.string().min(1).optional(),
        parts: z
            .array(
                z.object({
                    PartNumber: z.coerce.number().int().min(1),
                    ETag: z.string().min(1),
                }),
            )
            .min(1),
    }),
};

export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    if (!isR2Configured()) {
        return res.status(STATUS_CODES.SERVICE_UNAVAILABLE).json({
            message: 'R2 is not configured',
            code: 'r2_not_configured',
        });
    }

    const { id: eventId, photoId } = req.params as z.infer<typeof ValidationSchema.params>;
    const body = req.body as z.infer<typeof ValidationSchema.body>;
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
    if (!photo || !photo.orig_key || !photo.multipart_upload_id) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Photo upload not found' });
    }

    const uploadId = body.upload_id || photo.multipart_upload_id;
    if (uploadId !== photo.multipart_upload_id) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({ message: 'upload_id mismatch' });
    }

    const sortedParts = [...body.parts].sort((a, b) => a.PartNumber - b.PartNumber);

    await r2.send(
        new CompleteMultipartUploadCommand({
            Bucket: R2_BUCKET,
            Key: photo.orig_key,
            UploadId: uploadId,
            MultipartUpload: {
                Parts: sortedParts.map((p) => {
                    const cleaned = p.ETag.replace(/^"|"$/g, '');
                    return {
                        ETag: `"${cleaned}"`,
                        PartNumber: p.PartNumber,
                    };
                }),
            },
        }),
    );

    const head = await r2.send(
        new HeadObjectCommand({
            Bucket: R2_BUCKET,
            Key: photo.orig_key,
        }),
    );

    const sizeBytes = Number(head.ContentLength ?? 0);
    if (sizeBytes <= 0 || sizeBytes > MAX_PHOTO_BYTES) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
            message: 'Uploaded object size is invalid',
            code: 'invalid_size',
        });
    }

    await db.begin();
    try {
        const updated = await db.queryOne<PhotoRow>(
            `
                UPDATE photos
                SET status = 'uploaded',
                    size_bytes = $2,
                    multipart_upload_id = NULL,
                    updated_at = now()
                WHERE id = $1
                  AND status = 'uploading'
                RETURNING *
            `,
            [photoId, sizeBytes],
        );

        if (!updated) {
            await db.rollback();
            return res.status(STATUS_CODES.CONFLICT).json({ message: 'Photo already completed' });
        }

        await convertReservedToUsed(db, photo.purchase_id, 1);

        if (photo.upload_session_id) {
            await db.query(
                `
                    UPDATE upload_sessions
                    SET completed_count = completed_count + 1,
                        status = CASE
                          WHEN completed_count + 1 >= reserved_count THEN 'completed'
                          ELSE status
                        END,
                        updated_at = now()
                    WHERE id = $1
                      AND status = 'open'
                `,
                [photo.upload_session_id],
            );
        }

        await db.commit();

        await enqueueProcessPhoto({ photoId, eventId });

        return res.status(STATUS_CODES.OK).json({
            photo: publicPhoto(updated),
        });
    } catch (err) {
        await db.rollback();
        throw err;
    }
}
