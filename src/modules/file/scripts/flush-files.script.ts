import Database from '@/shared/helpers/database.helper.js';
import { hardDeleteFile } from '@/modules/file/file.service.js';
import Logger from '@/shared/configs/logger.js';

export async function task() {
    const db = await Database.getConnection();

    try {
        const filesToDelete = await db.queryAll(
            `
            SELECT
                id, key, _status
            FROM files
            WHERE
                _status in ('pending', 'deleted') AND
                created_at < NOW() - INTERVAL '5 minute'
            `,
        );

        for (const file of filesToDelete) {
            await hardDeleteFile(db, { id: file.id });
            Logger.info(`Deleted file: ${file.key}`);
        }
    } finally {
        db.release();
    }

    Logger.info('Process completed');
}
