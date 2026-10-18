import cron from 'node-cron';
import env from '@/shared/configs/env.js';

import { task as databaseBackupTask } from '@/scripts/databaseBackup.script.js';

const isProduction = env.ENV === 'production';

/**
# ┌────────────── second (optional)
# │ ┌──────────── minute
# │ │ ┌────────── hour
# │ │ │ ┌──────── day of month
# │ │ │ │ ┌────── month
# │ │ │ │ │ ┌──── day of week
# │ │ │ │ │ │
# │ │ │ │ │ │
# * * * * * *
*/

// Run at 2:00 AM every 3 days
export const DatabaseBackupJob = isProduction
    ? cron.createTask('0 1 */3 * *', './scripts/databaseBackup.script.js', {
          timezone: 'Asia/Kolkata',
      })
    : cron.createTask('0 1 */3 * *', databaseBackupTask, { timezone: 'Asia/Kolkata' });
