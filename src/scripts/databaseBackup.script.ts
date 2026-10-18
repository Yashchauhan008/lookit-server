import fs from 'fs';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3 } from '@/shared/configs/aws.js';

import env from '@/shared/configs/env.js';
import { parseDatabaseUrl } from '@/shared/configs/database.js';

const RETENTION_COUNT = 15;
const BACKUP_BUCKET = env.AWS_S3_BACKUP_BUCKET;
const serviceName = env.SERVICE_NAME;
const s3BackupKey = `${serviceName}/database-backup`;
const IST = 'Asia/Kolkata';

function formatTimestamp(d = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: IST,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
    const parts = formatter.formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const y = get('year');
    const m = get('month');
    const day = get('day');
    const h = get('hour');
    const min = get('minute');
    const s = get('second');
    return `${y}-${m}-${day}_${h}-${min}-${s}`;
}

function execPromise(cmd: string) {
    return new Promise<void>((resolve, reject) => {
        exec(cmd, (err) => (err ? reject(err) : resolve()));
    });
}

async function uploadToS3(filePath: string, key: string) {
    const stream = fs.createReadStream(filePath);
    await s3.send(
        new PutObjectCommand({
            Bucket: BACKUP_BUCKET,
            Key: key,
            Body: stream,
        }),
    );
}

async function applyRetention(prefix: string) {
    const res = await s3.send(
        new ListObjectsV2Command({
            Bucket: BACKUP_BUCKET,
            Prefix: prefix,
        }),
    );

    const files = (res.Contents || []).sort(
        (a, b) => new Date(a.LastModified).getTime() - new Date(b.LastModified).getTime(),
    );

    const oldFiles = files.slice(0, Math.max(0, files.length - RETENTION_COUNT));

    for (const f of oldFiles) {
        await s3.send(
            new DeleteObjectCommand({
                Bucket: BACKUP_BUCKET,
                Key: f.Key,
            }),
        );
    }
}

export async function task() {
    const date = formatTimestamp();
    const tmpFile = path.join(process.cwd(), 'tmp', `${date}.sql`);

    const { host, port, user, password, database } = parseDatabaseUrl(env.DATABASE_URL);
    const folder = path.join(s3BackupKey, database);
    const key = path.join(folder, `${date}.sql`);

    await execPromise(
        `PGPASSWORD=${password} pg_dump -h ${host} -p ${port} -U ${user} ${database} > ${tmpFile}`,
    );

    await uploadToS3(tmpFile, key);
    fs.unlinkSync(tmpFile);
    await applyRetention(folder);
}

// AUTO RUN WHEN EXECUTED DIRECTLY
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    task().catch((err) => {
        console.error('PG BACKUP FAILED ❌');
        console.error(err);
        process.exit(1);
    });
}
