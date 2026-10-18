import Database from '@/shared/helpers/database.helper.js';
import { convertImageToWebp } from '@/modules/file/file.service.js';
import Logger from '@/shared/configs/logger.js';

export async function task() {
    const filesToConvert = await Database.queryAll(`
        SELECT
            id, key
        FROM files
        WHERE
            _status = 'saved' AND
            key NOT LIKE '%.webp' AND
            ( key LIKE '%.png' OR key LIKE '%.jpg' OR key LIKE '%.jpeg')
    `);

    console.log(filesToConvert);

    const db = await Database.getConnection();

    try {
        for (const file of filesToConvert) {
            await convertImageToWebp(db, { id: file.id });
            Logger.info(`Converted file: ${file.key}`);
        }
    } finally {
        db.release();
    }

    return Logger.info('Process completed');
}
