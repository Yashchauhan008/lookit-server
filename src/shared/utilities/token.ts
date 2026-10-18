import crypto from 'node:crypto';
import {
    EncryptJWT,
    SignJWT,
    jwtDecrypt,
    jwtVerify,
    type JWTPayload,
} from 'jose';
import env from '@/shared/configs/env.js';

// Derive a fixed-length secret key from the JWT_SECRET.
// This ensures it is compatible with both HS256 and A128CBC-HS256 (dir).
const secret = crypto.createHash('sha256').update(env.JWT_SECRET, 'utf8').digest();
const algorithm = 'HS256';

export async function createJWTToken<T extends JWTPayload | Record<string, unknown>>(
    payload: T,
    expirationTime: string | number | Date,
): Promise<string> {
    return new SignJWT(payload as JWTPayload)
        .setProtectedHeader({ alg: algorithm })
        .setExpirationTime(expirationTime)
        .sign(secret);
}

export async function decodeJWTToken<T = JWTPayload>(token: string): Promise<T | null> {
    try {
        const { payload } = await jwtVerify(token, secret, { algorithms: [algorithm] });
        return payload as T;
    } catch {
        return null;
    }
}

export async function createEncryptedToken<T extends Record<string, unknown>>(
    payload: T,
    expirationTime: string | number | Date,
): Promise<string> {
    return new EncryptJWT(payload)
        .setProtectedHeader({ alg: 'dir', enc: 'A128CBC-HS256' })
        .setExpirationTime(expirationTime)
        .encrypt(secret);
}

export async function decryptEncryptedToken<T = unknown>(token: string): Promise<T | null> {
    try {
        const { payload } = await jwtDecrypt(token, secret);
        return payload as T;
    } catch {
        return null;
    }
}
