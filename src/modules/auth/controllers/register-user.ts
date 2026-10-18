import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { createEncryptedToken } from '@/shared/utilities/token.js';
import { STATUS_CODES as StatusCodes } from '@/shared/constants/status-codes.js';
import RedisClient from '@/shared/configs/redis.js';
import z from 'zod';
import { sendMail, renderEmailTemplates } from '@/shared/utilities/mail.js';
import { TOKEN_TYPES } from '../auth.constant.js';
import Logger from '@/shared/configs/logger.js';

export const ValidationSchema = {
    body: z.object({
        name: z.string().trim().min(1).max(255),
        email: z.email().trim().toLowerCase(),
        password: z.string().trim().min(5).max(255),
    }),
};

export async function Controller(
    req: Request,
    res: Response,
    next: NextFunction,
    db: DatabaseClient,
) {
    const { name, email, password } = req.body as z.infer<typeof ValidationSchema.body>;

    const user = await db.queryOne('SELECT id FROM users WHERE email = $1', [email]);
    if (user) return res.status(StatusCodes.CONFLICT).json({ message: 'User already exists' });

    const token = await createEncryptedToken(
        {
            type: TOKEN_TYPES.USER_REGISTRATION_TOKEN,
            name,
            email,
            password,
        },
        '10m',
    );

    const otp = Math.floor(100000 + Math.random() * 900000);
    await RedisClient.set(token, otp, { EX: 10 * 60 });

    const emailHtml = await renderEmailTemplates('email-verification', {
        name,
        code: otp.toString(),
    });

    sendMail({ to: email, subject: 'Email Verification', html: emailHtml }).catch((error) => {
        Logger.error(error.message);
    });

    return res.status(StatusCodes.OK).json({
        token,
    });
}
