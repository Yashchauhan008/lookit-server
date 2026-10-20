import dotenv from 'dotenv';
import path from 'path';
import z from 'zod';

dotenv.config({
    path: path.join(process.cwd(), '.env'),
    override: true,
});

const envSchema = z.object({
    ENV: z.enum(['development', 'production', 'stage']).default('development'),
    PORT: z.coerce.number().int().positive().max(65535).default(3007),
    SERVICE_NAME: z.string().min(1).max(255).default('Boilerplate'),

    // Authentication
    JWT_SECRET: z.string().min(5).max(255),

    // Logging
    CONSOLE_LOG_LEVEL: z
        .enum(['false', 'error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
        .default('info'),
    FILE_LOG_LEVEL: z
        .enum(['false', 'error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
        .default('info'),

    // File Storage
    FILE_STORAGE_ENDPOINT: z.url().default('http://localhost:3007/files'),
    FILE_STORAGE_PATH: z.string().min(3).max(255).default(path.join(process.cwd(), 'files')),

    // Database
    DATABASE_URL: z.url(),

    // Redis
    REDIS_URL: z.string().url().default('redis://localhost:6379'),

    // SMTP
    SMTP_HOST: z.string(),
    SMTP_PORT: z.coerce.number().int().positive().max(65535),
    SMTP_USER: z.string(),
    SMTP_PASSWORD: z.string(),

    // Media object store: s3 now, r2 when Cloudflare account is ready
    MEDIA_STORAGE_PROVIDER: z.enum(['s3', 'r2']).default('s3'),

    // AWS — Rekognition, backup, and (when MEDIA_STORAGE_PROVIDER=s3) photo media
    AWS_REGION: z.string().default('ap-south-1'),
    AWS_ACCESS_KEY_ID: z.string().default('dummy'),
    AWS_SECRET_ACCESS_KEY: z.string().default('dummy'),
    AWS_S3_BACKUP_BUCKET: z.string().default('lookit-backups-dev'),
    AWS_S3_MEDIA_BUCKET: z.string().default('lookit-media-dev'),
    AWS_S3_PUBLIC_BASE_URL: z.string().default(''),

    // Cloudflare R2 — flip MEDIA_STORAGE_PROVIDER=r2 when ready
    R2_ACCOUNT_ID: z.string().default('dummy'),
    R2_ACCESS_KEY_ID: z.string().default('dummy'),
    R2_SECRET_ACCESS_KEY: z.string().default('dummy'),
    R2_BUCKET: z.string().default('lookit-media-dev'),
    R2_PUBLIC_BASE_URL: z.string().default('https://media.lookit.studio'),

    // Lookit
    ADMIN_EMAIL: z.email().default('admin@lookit.studio'),
    MAIL_FROM: z.string().optional(),
    APP_BASE_URL: z.string().default('http://localhost:5173'),
    API_BASE_URL: z.string().default('http://localhost:3007'),
    CORS_ORIGINS: z.string().default('http://localhost:5173'),
    FACE_ENGINE: z.enum(['rekognition', 'self_hosted']).default('rekognition'),
    FACE_MATCH_THRESHOLD: z.coerce.number().default(90),
    DAILY_FACE_CALL_CAP: z.coerce.number().int().positive().default(5000),
});

const { data: env, error } = envSchema.safeParse(process.env);

if (error) throw new Error(`Invalid ENV options: ${error.message}`);

export default env;
