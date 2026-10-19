import multer from 'multer';
import path from 'path';
import type { Request } from 'express';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';

const allowed = new Set(['jpg', 'jpeg', 'png', 'webp']);

function fileFilter(
    _req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback,
) {
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    const ok =
        allowed.has(ext) ||
        file.mimetype === 'image/jpeg' ||
        file.mimetype === 'image/png' ||
        file.mimetype === 'image/webp';
    if (ok) cb(null, true);
    else cb(new Error('Selfie must be JPEG, PNG, or WebP'));
}

/** In-memory only — selfie never written to disk. */
export const selfieUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
});

export function selfieUploadError(
    err: unknown,
    _req: Request,
    res: import('express').Response,
    next: import('express').NextFunction,
) {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(STATUS_CODES.BAD_REQUEST).json({
                message: 'Selfie must be under 5 MB',
                code: 'selfie_too_large',
            });
        }
        return res.status(STATUS_CODES.BAD_REQUEST).json({ message: err.message });
    }
    if (err instanceof Error) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({ message: err.message });
    }
    return next(err);
}
