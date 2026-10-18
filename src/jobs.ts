import { DatabaseBackupJob } from '@/cron.js';
import { FlushFilesJob, FlushUnTrackedFilesJob } from '@/modules/file/file.cron.js';
import Logger from '@/shared/configs/logger.js';

export function initializeJobs() {
    DatabaseBackupJob.start();
    FlushFilesJob.start();
    FlushUnTrackedFilesJob.start();
    Logger.info('Background Jobs initialized');
}
