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
    const file = req.file;

    if (!file) return res.status(STATUS_CODES.BAD_REQUEST).json({ message: 'File is required' });

    const newFile = await registerNewFile(db, { filePath: file.path });

    return res.status(STATUS_CODES.OK).json(newFile);
}
