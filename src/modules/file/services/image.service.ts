import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import ServerError from '@/shared/utilities/server-error.class.js';
import { convertToWebp } from '@/shared/utilities/file.js';
import { deleteFile as deleteFileFromStorage } from '@/shared/utilities/file.js';

export async function convertImageToWebp(db: DatabaseClient, { id }: { id: string }) {
    const file = await db.queryOne('SELECT id, key FROM files WHERE id = $1', [id]);
    if (!file) throw new ServerError('NOT_FOUND', 'File not found');
    if (file.key.endsWith('.webp')) return file.key;
    const webpKey = await convertToWebp(file.key);
    await db.query('UPDATE files SET key = $1 WHERE id = $2', [webpKey, id]);
    await deleteFileFromStorage(file.key);
    return webpKey;
}
