import ServerError from '@/shared/utilities/server-error.class.js';
import { upload, deleteFile as deleteFileFromStorage } from '@/shared/utilities/file.js';
import Event from '@/shared/configs/server-event.js';
import env from '@/shared/configs/env.js';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';

export async function registerNewFile(
    db: DatabaseClient,
    { filePath, _status = 'pending' }: { filePath: string; _status?: string },
) {
    const key = await upload(filePath);
    const file = await db.queryOne(
        'INSERT INTO files (key, _status, endpoint) VALUES ($1, $2, $3) RETURNING *',
        [key, _status, env.FILE_STORAGE_ENDPOINT],
    );
    Event.emit('file:registered', file);
    return file;
}

export async function hardDeleteFile(db: DatabaseClient, { id }: { id: string }) {
    const file = await db.queryOne('SELECT id, key FROM files WHERE id = $1', [id]);
    if (!file) return;
    await db.query('DELETE FROM files WHERE id = $1', [id]);
    await deleteFileFromStorage(file.key);
}

export async function updateFileStatus(
    db: DatabaseClient,
    { id, status }: { id: string; status: string },
) {
    const file = await db.queryOne('SELECT id, key, _status FROM files WHERE id = $1', [id]);
    if (!file) throw new ServerError('NOT_FOUND', 'File not found');
    if (file._status === status) return file;
    await db.query('UPDATE files SET _status = $1 WHERE id = $2', [status, id]);
    return file;
}

export async function saveFile(db: DatabaseClient, { id }: { id: string }) {
    const file = await updateFileStatus(db, { id, status: 'saved' });
    Event.emit('file:saved', file);
}

export async function deleteFile(db: DatabaseClient, { id }: { id: string }) {
    return await updateFileStatus(db, { id, status: 'deleted' });
}
