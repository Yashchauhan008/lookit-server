import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import sharp from 'sharp';
import crypto from 'node:crypto';
import env from '@/shared/configs/env.js';
import { signedGetUrl } from '@/shared/configs/media-storage.js';
import { createFaceEngine } from '@/modules/faces/face-engine.factory.js';
import { assertFaceApiBudget } from '@/modules/faces/face-usage.service.js';
import {
    getConsentVersion,
    loadPublicEventBySlug,
    storeGuestMatches,
} from '../guest.helpers.js';
import {
    isUuid,
    issueScanToken,
    replacePreviousSelfies,
    saveSelfie,
    type ScanStatus,
} from '../guest-scans.helpers.js';

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
    const guest = req.guest!;
    const file = req.file;

    if (!file?.buffer?.length) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
            message: 'Selfie image required (field: selfie)',
            code: 'selfie_required',
        });
    }

    const event = await loadPublicEventBySlug(db, slug);
    if (!event || event.id !== guest.event_id) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Event not found' });
    }

    let jpeg: Buffer;
    try {
        jpeg = await sharp(file.buffer, { failOn: 'none' })
            .rotate()
            .resize({
                width: 1600,
                height: 1600,
                fit: 'inside',
                withoutEnlargement: true,
            })
            .jpeg({ quality: 88 })
            .toBuffer();
    } catch {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
            message: 'Could not read selfie image. Try another photo.',
            code: 'selfie_invalid',
        });
    }

    if (jpeg.byteLength > 5 * 1024 * 1024) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
            message: 'Selfie too large after processing',
            code: 'selfie_too_large',
        });
    }

    // Detect at least one face before search (cheap local check via sharp metadata only —
    // Rekognition SearchFacesByImage returns InvalidParameter when no face)
    try {
        await assertFaceApiBudget(db, event.id, 1);
    } catch (err: any) {
        return res.status(err.statusCode || 429).json({
            message: err.message,
            code: err.code || 'face_cap',
        });
    }

    const consentVersion = await getConsentVersion(db);
    const rawGuestId = (req.body as { guest_id?: unknown } | undefined)?.guest_id;
    const guestId = isUuid(rawGuestId) ? rawGuestId : crypto.randomUUID();

    /** Save this scan (selfie + which photos matched) and hand the guest a token to reopen it later. */
    const recordScan = async (status: ScanStatus, matchedIds: string[], keepSelfie: boolean) => {
        if (keepSelfie) await replacePreviousSelfies(db, event.id, guestId);
        const scan = await db.queryOne<{ id: string; event_id: string }>(
            `
                INSERT INTO guest_scans (event_id, guest_id, matched_photo_ids, match_count, status, consent_version)
                VALUES ($1, $2, $3::uuid[], $4, $5, $6)
                RETURNING id, event_id
            `,
            [event.id, guestId, matchedIds, matchedIds.length, status, consentVersion],
        );
        if (keepSelfie) {
            const key = await saveSelfie(event.id, scan!.id, jpeg);
            if (key) await db.query('UPDATE guest_scans SET selfie_key = $2 WHERE id = $1', [scan!.id, key]);
        }
        return {
            scan_id: scan!.id,
            guest_id: guestId,
            scan_token: await issueScanToken(scan!, consentVersion),
        };
    };

    const engine = createFaceEngine(db);
    let matches;
    try {
        matches = await engine.searchBySelfie(
            event.id,
            jpeg,
            env.FACE_MATCH_THRESHOLD,
        );
    } catch (err: any) {
        const name = err?.name || err?.Code || '';
        if (
            name === 'AbortError' ||
            name === 'TimeoutError' ||
            err?.code === 'ENOTFOUND' ||
            err?.code === 'EAI_AGAIN' ||
            String(err?.message || '').includes('aborted')
        ) {
            return res.status(503).json({
                message: 'Face search timed out. Check the connection and try again.',
                code: 'face_search_timeout',
            });
        }
        if (
            name === 'InvalidParameterException' ||
            String(err?.message || '').includes('no face') ||
            String(err?.message || '').includes('There are no faces')
        ) {
            await recordScan('no_face', [], false);
            return res.status(STATUS_CODES.OK).json({
                photos: [],
                match_count: 0,
                message: 'No face found in your selfie. Please retake with your face clearly visible.',
                code: 'no_face_in_selfie',
            });
        }
        throw err;
    }

    const photoIds: string[] = [];
    const seen = new Set<string>();
    for (const m of matches) {
        if (m.photoId && !seen.has(m.photoId)) {
            seen.add(m.photoId);
            photoIds.push(m.photoId);
        }
    }

    await storeGuestMatches(guest.jti, event.id, photoIds);

    await db.query(
        `
            INSERT INTO analytics_events (event_id, type, meta)
            VALUES ($1, 'search', $2::jsonb)
        `,
        [
            event.id,
            JSON.stringify({
                match_count: photoIds.length,
                consent_version: await getConsentVersion(db),
            }),
        ],
    );

    if (!photoIds.length) {
        const scan = await recordScan('no_match', [], true);
        return res.status(STATUS_CODES.OK).json({
            photos: [],
            match_count: 0,
            message: 'No matching photos found. Try another selfie or better lighting.',
            code: 'no_matches',
            ...scan,
        });
    }

    const rows = await db.queryAll<{
        id: string;
        thumb_key: string | null;
        prev_key: string | null;
        orig_key: string | null;
        original_filename: string | null;
        faces_count: number;
    }>(
        `
            SELECT id, thumb_key, prev_key, orig_key, original_filename, faces_count
            FROM photos
            WHERE event_id = $1
              AND id = ANY($2::uuid[])
              AND status IN ('indexed', 'processed', 'uploaded')
            ORDER BY created_at DESC
        `,
        [event.id, photoIds],
    );

    const photos = await Promise.all(
        rows.map(async (row) => {
            const thumbKey = row.thumb_key || row.prev_key || row.orig_key;
            const previewKey = row.prev_key || row.orig_key;
            return {
                id: row.id,
                original_filename: row.original_filename,
                faces_count: row.faces_count,
                thumb_url: thumbKey ? await signedGetUrl(thumbKey, 3600) : null,
                preview_url: previewKey ? await signedGetUrl(previewKey, 3600) : null,
            };
        }),
    );

    const scan = await recordScan(
        photos.length ? 'matched' : 'no_match',
        photos.map((p) => p.id),
        true,
    );

    return res.status(STATUS_CODES.OK).json({
        photos,
        match_count: photos.length,
        ...scan,
    });
}
