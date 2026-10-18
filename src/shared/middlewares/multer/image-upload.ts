import path from 'path';
import multer from 'multer';
import storage from './storage.js';
import ServerError from '@/shared/utilities/server-error.class.js';
import type { Request } from 'express';

const imageFileExtensions = [
    'jpg',
    'jpeg',
    'png',
    'webp',
    'tiff',
    'bmp',
    'svg',
    'ico',
    'heif',
    'heic',
];

export const fileFilter = (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
) => {
    const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);
    if (imageFileExtensions.includes(fileExtension)) cb(null, true);
    else
        cb(
            new ServerError(
                'ERROR',
                'Please upload a valid image file (jpg, jpeg, png, webp, etc.).',
            ),
            false,
        );
};

export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10485760 }, // 10MB
});
