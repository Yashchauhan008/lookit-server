import Database from '@/shared/helpers/database.helper.js';
import { getAllFileKeys } from '@/shared/utilities/file.js';
import path from 'path';
import env from '@/shared/configs/env.js';
import fsp from 'fs/promises';
import Logger from '@/shared/configs/logger.js';

export async function task() {
    const dbFiles = await Database.queryAll('SELECT id, key, _status FROM files');

    const dbFilesKeys = dbFiles.map((file) => file.key);
    const storageFiles = await getAllFileKeys();

    for (const file of storageFiles) {
        if (!dbFilesKeys.includes(file)) {
            await fsp.unlink(path.join(env.FILE_STORAGE_PATH, file));
            Logger.info(`Deleted file: ${file}`);
        }
    }

    Logger.info('Process completed');
}
