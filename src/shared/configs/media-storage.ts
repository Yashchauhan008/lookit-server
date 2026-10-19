import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import env from './env.js';

export type MediaStorageProvider = 's3' | 'r2';

export const mediaProvider: MediaStorageProvider = env.MEDIA_STORAGE_PROVIDER;

function isNonDummy(value: string | undefined): boolean {
    return Boolean(value && value !== 'dummy');
}

/** True when the active media provider has usable credentials. */
export function isMediaStorageConfigured(): boolean {
    if (mediaProvider === 'r2') {
        return (
            isNonDummy(env.R2_ACCOUNT_ID) &&
            isNonDummy(env.R2_ACCESS_KEY_ID) &&
            isNonDummy(env.R2_SECRET_ACCESS_KEY) &&
            Boolean(env.R2_BUCKET)
        );
    }

    return (
        isNonDummy(env.AWS_ACCESS_KEY_ID) &&
        isNonDummy(env.AWS_SECRET_ACCESS_KEY) &&
        Boolean(env.AWS_S3_MEDIA_BUCKET) &&
        env.AWS_S3_MEDIA_BUCKET !== 'dummy'
    );
}

function createMediaClient(): S3Client {
    if (mediaProvider === 'r2') {
        return new S3Client({
            region: 'auto',
            endpoint: `https://${env.R2_ACCOUNT_ID || 'dummy'}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: env.R2_ACCESS_KEY_ID || 'dummy',
                secretAccessKey: env.R2_SECRET_ACCESS_KEY || 'dummy',
            },
        });
    }

    return new S3Client({
        region: env.AWS_REGION,
        credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID || 'dummy',
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY || 'dummy',
        },
    });
}

/** Active media object store (AWS S3 now, Cloudflare R2 later). */
export const mediaS3 = createMediaClient();

export const MEDIA_BUCKET =
    mediaProvider === 'r2' ? env.R2_BUCKET : env.AWS_S3_MEDIA_BUCKET;

const publicBase =
    mediaProvider === 'r2'
        ? env.R2_PUBLIC_BASE_URL
        : env.AWS_S3_PUBLIC_BASE_URL ||
          `https://${env.AWS_S3_MEDIA_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com`;

export const MEDIA_PUBLIC_BASE_URL = publicBase.replace(/\/$/, '');

export function publicObjectUrl(key: string): string {
    return `${MEDIA_PUBLIC_BASE_URL}/${key.replace(/^\//, '')}`;
}

/** Short-lived signed GET for private bucket objects (studio previews). */
export async function signedGetUrl(key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(
        mediaS3,
        new GetObjectCommand({
            Bucket: MEDIA_BUCKET,
            Key: key,
        }),
        { expiresIn },
    );
}

export async function putMediaObject(
    key: string,
    body: Buffer,
    contentType: string,
): Promise<void> {
    await mediaS3.send(
        new PutObjectCommand({
            Bucket: MEDIA_BUCKET,
            Key: key,
            Body: body,
            ContentType: contentType,
        }),
    );
}

export { GetObjectCommand };

export function mediaStorageNotConfiguredMessage(): string {
    if (mediaProvider === 'r2') {
        return 'R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET in .env';
    }
    return 'S3 media bucket is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_MEDIA_BUCKET in .env (or switch MEDIA_STORAGE_PROVIDER=r2 when ready)';
}

/** @deprecated use isMediaStorageConfigured */
export const isR2Configured = isMediaStorageConfigured;
/** @deprecated use mediaS3 */
export const r2 = mediaS3;
/** @deprecated use MEDIA_BUCKET */
export const R2_BUCKET = MEDIA_BUCKET;
