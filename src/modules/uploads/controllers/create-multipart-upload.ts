import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import {
    CreateMultipartUploadCommand,
    AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { requireOwnedEvent, type PhotoRow, type UploadSessionRow } from '../uploads.helpers.js';
import {
    ACCEPTED_CONTENT_TYPES,
    extensionFor,
    MAX_PHOTO_BYTES,
    MULTIPART_PART_SIZE,
    normalizeContentType,
} from '../uploads.constants.js';
import { isR2Configured, r2, R2_BUCKET } from '@/shared/configs/r2.js';

export const ValidationSchema = {
    params: z.object({
        id: z.uuid(),
        sessionId: z.uuid(),
    }),
    body: z.object({
        filename: z.string().trim().min(1).max(512),
        content_type: z.string().trim().min(3).max(128),
        size_bytes: z.coerce.number().int().positive().max(MAX_PHOTO_BYTES),
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

    const { id: eventId, sessionId } = req.params as z.infer<typeof ValidationSchema.params>;
    const body = req.body as z.infer<typeof ValidationSchema.body>;
    const userId = req.user!.id;

    const contentType = normalizeContentType(body.content_type);
    if (!ACCEPTED_CONTENT_TYPES.has(contentType)) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
            message: 'Only JPEG and PNG are accepted (HEIC comes later)',
            code: 'unsupported_type',
        });
    }

    const event = await requireOwnedEvent(db, eventId, userId);
    if (!event) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Event not found' });
    }

    const session = await db.queryOne<UploadSessionRow>(
        `
            SELECT *
            FROM upload_sessions
            WHERE id = $1
              AND event_id = $2
              AND user_id = $3
              AND status = 'open'
              AND expires_at > now()
        `,
        [sessionId, eventId, userId],
    );
    if (!session) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Upload session not found' });
    }

    const claimed = await db.queryOne<{ count: string }>(
        `
            SELECT COUNT(*)::text AS count
            FROM photos
            WHERE upload_session_id = $1
              AND status <> 'failed'
        `,
        [sessionId],
    );
    if (Number(claimed?.count ?? 0) >= session.reserved_count) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
            message: 'Session quota exhausted — create a new upload session',
            code: 'session_full',
        });
    }

    const purchase = await db.queryOne<{ retention_end: string }>(
        `SELECT retention_end FROM plan_purchases WHERE id = $1`,
        [session.purchase_id],
    );

    let photo: PhotoRow | null = null;
    let uploadId: string | undefined;

    try {
        await db.begin();

        photo = await db.queryOne<PhotoRow>(
            `
                INSERT INTO photos (
                  event_id, purchase_id, upload_session_id,
                  status, expires_at, content_type, original_filename, size_bytes
                )
                VALUES ($1, $2, $3, 'uploading', $4, $5, $6, $7)
                RETURNING *
            `,
            [
                eventId,
                session.purchase_id,
                sessionId,
                purchase!.retention_end,
                contentType,
                body.filename,
                body.size_bytes,
            ],
        );

        const ext = extensionFor(contentType, body.filename);
        const key = `orig/${eventId}/${photo!.id}.${ext}`;

        const created = await r2.send(
            new CreateMultipartUploadCommand({
                Bucket: R2_BUCKET,
                Key: key,
                ContentType: contentType,
            }),
        );
        uploadId = created.UploadId;
        if (!uploadId) throw new Error('R2 CreateMultipartUpload returned no UploadId');

        photo = await db.queryOne<PhotoRow>(
            `
                UPDATE photos
                SET orig_key = $2,
                    multipart_upload_id = $3,
                    updated_at = now()
                WHERE id = $1
                RETURNING *
            `,
            [photo!.id, key, uploadId],
        );

        await db.commit();

        return res.status(STATUS_CODES.CREATED).json({
            photo_id: photo!.id,
            key,
            upload_id: uploadId,
            part_size: MULTIPART_PART_SIZE,
            content_type: contentType,
        });
    } catch (err) {
        await db.rollback();
        if (uploadId && photo?.orig_key) {
            try {
                await r2.send(
                    new AbortMultipartUploadCommand({
                        Bucket: R2_BUCKET,
                        Key: photo.orig_key,
                        UploadId: uploadId,
                    }),
                );
            } catch {
                /* ignore cleanup errors */
            }
        }
        throw err;
    }
}
