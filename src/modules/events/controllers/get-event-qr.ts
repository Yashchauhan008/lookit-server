import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import z from 'zod';
import QRCode from 'qrcode';
import env from '@/shared/configs/env.js';

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

    const row = await db.queryOne<{ slug: string }>(
        `
            SELECT slug FROM events
            WHERE id = $1 AND owner_id = $2 AND status <> 'deleted'
        `,
        [id, req.user!.id],
    );

    if (!row) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Event not found' });
    }

    const url = `${env.APP_BASE_URL}/e/${row.slug}`;
    const png = await QRCode.toBuffer(url, {
        type: 'png',
        width: 512,
        margin: 2,
        errorCorrectionLevel: 'M',
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="lookit-${row.slug}.png"`);
    return res.status(STATUS_CODES.OK).send(png);
}
