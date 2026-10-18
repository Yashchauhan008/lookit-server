import type { NextFunction, Request, Response } from 'express';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';

export async function Controller(req: Request, res: Response, _next: NextFunction) {
    if (!req.user) {
        return res.status(STATUS_CODES.UNAUTHORIZED).json({ message: 'Unauthorized' });
    }

    return res.status(STATUS_CODES.OK).json({
        user: {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role,
            status: req.user.status,
            studio_name: req.user.studio_name,
        },
    });
}
