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

    // AWS
    AWS_REGION: z.string(),
    AWS_ACCESS_KEY_ID: z.string(),
    AWS_SECRET_ACCESS_KEY: z.string(),
    AWS_S3_BACKUP_BUCKET: z.string(),
});

const { data: env, error } = envSchema.safeParse(process.env);

if (error) throw new Error(`Invalid ENV options: ${error.message}`);

export default env;
