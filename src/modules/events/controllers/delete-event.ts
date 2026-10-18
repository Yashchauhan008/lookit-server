import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';

export const ValidationSchema = {
    params: z.object({
        id: z.uuid(),
    }),
};

export async function Controller(
    req: Request,
    res: Response,
    _next: NextFunction,
    db: DatabaseClient,
) {
    const { id } = req.params as z.infer<typeof ValidationSchema.params>;

    const row = await db.queryOne(
        `
            UPDATE events
            SET status = 'deleted', updated_at = now()
            WHERE id = $1 AND owner_id = $2 AND status <> 'deleted'
            RETURNING id
        `,
        [id, req.user!.id],
    );

    if (!row) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Event not found' });
    }

    // Hard R2 / Rekognition cleanup lands with worker jobs later
    return res.status(STATUS_CODES.OK).json({ message: 'Event deleted' });
}
