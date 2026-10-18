import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import { AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { requireOwnedEvent, type PhotoRow, type UploadSessionRow } from '../uploads.helpers.js';
import { releaseReserved } from '../quota.service.js';
import { isR2Configured, r2, R2_BUCKET } from '@/shared/configs/r2.js';

export const ValidationSchema = {
    params: z.object({
        id: z.uuid(),
        sessionId: z.uuid(),
    }),
};

export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    const { id: eventId, sessionId } = req.params as z.infer<typeof ValidationSchema.params>;
    const userId = req.user!.id;

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
        `,
        [sessionId, eventId, userId],
    );
    if (!session) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Upload session not found' });
    }

    const pending = await db.queryAll<PhotoRow>(
        `
            SELECT *
            FROM photos
            WHERE upload_session_id = $1
              AND status = 'uploading'
        `,
        [sessionId],
    );

    if (isR2Configured()) {
        await Promise.all(
            pending.map(async (photo) => {
                if (!photo.orig_key || !photo.multipart_upload_id) return;
                try {
                    await r2.send(
                        new AbortMultipartUploadCommand({
                            Bucket: R2_BUCKET,
                            Key: photo.orig_key,
                            UploadId: photo.multipart_upload_id,
                        }),
                    );
                } catch {
                    /* ignore */
                }
            }),
        );
    }

    const remainingReserved = session.reserved_count - session.completed_count;

    await db.begin();
    try {
        if (pending.length) {
            await db.query(
                `
                    UPDATE photos
                    SET status = 'failed',
                        error = 'session_aborted',
                        multipart_upload_id = NULL,
                        updated_at = now()
                    WHERE upload_session_id = $1
                      AND status = 'uploading'
                `,
                [sessionId],
            );
        }

        await releaseReserved(db, session.purchase_id, remainingReserved);

        await db.query(
            `
                UPDATE upload_sessions
                SET status = 'aborted',
                    reserved_count = completed_count,
                    updated_at = now()
                WHERE id = $1
            `,
            [sessionId],
        );

        await db.commit();
    } catch (err) {
        await db.rollback();
        throw err;
    }

    return res.status(STATUS_CODES.OK).json({
        message: 'Upload session aborted',
        released: remainingReserved,
    });
}
