import { S3Client } from '@aws-sdk/client-s3';
import env from './env.js';

export function isR2Configured(): boolean {
    return Boolean(
        env.R2_ACCOUNT_ID &&
            env.R2_ACCESS_KEY_ID &&
            env.R2_SECRET_ACCESS_KEY &&
            env.R2_BUCKET &&
            env.R2_ACCOUNT_ID !== 'dummy' &&
            env.R2_ACCESS_KEY_ID !== 'dummy',
    );
}

/** S3-compatible client pointed at Cloudflare R2 (not AWS S3 / MinIO). */
export const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID || 'dummy'}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID || 'dummy',
        secretAccessKey: env.R2_SECRET_ACCESS_KEY || 'dummy',
    },
});

export const R2_BUCKET = env.R2_BUCKET;
export const R2_PUBLIC_BASE_URL = env.R2_PUBLIC_BASE_URL.replace(/\/$/, '');

export function publicObjectUrl(key: string): string {
    return `${R2_PUBLIC_BASE_URL}/${key.replace(/^\//, '')}`;
}
