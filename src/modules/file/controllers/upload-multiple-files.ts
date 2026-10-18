import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { registerNewFile } from '@/modules/file/file.service.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';

export async function Controller(
    req: Request,
    res: Response,
    next: NextFunction,
    db: DatabaseClient,
) {
    const files = req.files;

    if (!files || !Array.isArray(files) || files.length === 0)
        return res.status(STATUS_CODES.BAD_REQUEST).json({ message: 'Files are required' });

    const newFiles = await Promise.all(
        files.map((file) => registerNewFile(db, { filePath: file.path })),
    );

    return res.status(STATUS_CODES.OK).json(newFiles);
}
