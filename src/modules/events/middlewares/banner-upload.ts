import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** In-memory; the controller re-encodes to WebP before it touches storage. */
export const bannerUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES },
    fileFilter: (_req, file, cb) =>
        TYPES.has(file.mimetype) ? cb(null, true) : cb(new Error('Banner must be JPEG, PNG, or WebP')),
});

export function bannerUploadError(err: unknown, _req: Request, res: Response, next: NextFunction) {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(STATUS_CODES.BAD_REQUEST).json({ message: 'Banner must be under 8 MB' });
    }
    if (err instanceof Error) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({ message: err.message });
    }
    return next(err);
}
