import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { createEncryptedToken } from '@/shared/utilities/token.js';
import { STATUS_CODES as StatusCodes } from '@/shared/constants/status-codes.js';
import RedisClient from '@/shared/configs/redis.js';
import z from 'zod';
import { sendMail, renderEmailTemplates } from '@/shared/utilities/mail.js';
import { TOKEN_TYPES } from '../auth.constant.js';
import Logger from '@/shared/configs/logger.js';
import env from '@/shared/configs/env.js';

export const ValidationSchema = {
    body: z.object({
        name: z.string().trim().min(1).max(255),
        email: z.email().trim().toLowerCase(),
        password: z.string().trim().min(5).max(255),
        studio_name: z.string().trim().min(1).max(255).optional(),
    }),
};

export async function Controller(
    req: Request,
    res: Response,
    next: NextFunction,
    db: DatabaseClient,
) {
    const { name, email, password, studio_name } = req.body as z.infer<
        typeof ValidationSchema.body
    >;

    const user = await db.queryOne('SELECT id FROM users WHERE email = $1', [email]);
    if (user) return res.status(StatusCodes.CONFLICT).json({ message: 'User already exists' });

    const token = await createEncryptedToken(
        {
            type: TOKEN_TYPES.USER_REGISTRATION_TOKEN,
            name,
            email,
            password,
            studio_name: studio_name ?? null,
        },
        '10m',
    );

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await RedisClient.set(token, otp, { EX: 10 * 60 });

    const emailHtml = await renderEmailTemplates('email-verification', {
        name,
        code: otp,
    });

    try {
        const mailResult = await sendMail({
            to: email,
            subject: 'Your Lookit verification code',
            html: emailHtml,
            text: `Hello ${name}, your Lookit verification code is ${otp}. It is valid for 10 minutes.`,
        });
        Logger.info(
            `OTP email sent to ${email} messageId=${mailResult.messageId} accepted=${mailResult.accepted.join(',')}`,
        );
    } catch (error) {
        Logger.error(
            `OTP email failed for ${email}: ${error instanceof Error ? error.message : String(error)}`,
        );
        return res.status(StatusCodes.BAD_GATEWAY).json({
            message: 'Could not send OTP email. Please try again.',
            code: 'otp_email_failed',
        });
    }

    // Dummy SMTP in local — expose OTP so we can finish the flow without real mail
    const payload: Record<string, unknown> = {
        token,
        message: 'OTP sent to email. Check spam folder if needed.',
    };
    if (env.ENV === 'development') {
        payload.dev_otp = otp;
        Logger.info(`Dev OTP for ${email}: ${otp}`);
    }

    return res.status(StatusCodes.OK).json(payload);
}
