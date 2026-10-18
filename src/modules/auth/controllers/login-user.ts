import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import { TOKEN_TYPES } from '../auth.constant.js';
import z from 'zod';
import bcrypt from 'bcryptjs';
import { createJWTToken } from '@/shared/utilities/token.js';

export const ValidationSchema = {
    body: z.object({
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
    const { email, password } = req.body as z.infer<typeof ValidationSchema.body>;

    const user = await db.queryOne('SELECT * FROM users WHERE email = $1', [email]);

    if (!user)
        return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Invalid email or password' });

    if (user.status === 'suspended')
        return res.status(STATUS_CODES.FORBIDDEN).json({ message: 'Account suspended' });

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid)
        return res.status(STATUS_CODES.BAD_REQUEST).json({ message: 'Invalid email or password' });

    const accessToken = await createJWTToken(
        { type: TOKEN_TYPES.USER_ACCESS_TOKEN, user_id: user.id, role: user.role },
        '24h',
    );

    return res.status(STATUS_CODES.OK).json({
        token: accessToken,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            studio_name: user.studio_name,
        },
    });
}
