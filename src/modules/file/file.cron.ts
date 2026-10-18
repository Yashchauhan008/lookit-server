import cron from 'node-cron';
import env from '@/shared/configs/env.js';

import { task as flushUnTrackedFilesTask } from './scripts/flush-untracked-files.script.js';
import { task as flushFilesTask } from './scripts/flush-files.script.js';

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

// Run at midnight every 10 days
export const FlushUnTrackedFilesJob = isProduction
    ? cron.createTask('0 0 */10 * *', './scripts/flush-untracked-files.script.js', {
          timezone: 'Asia/Kolkata',
      })
    : cron.createTask('0 0 */10 * *', flushUnTrackedFilesTask, { timezone: 'Asia/Kolkata' });

// Run at 2:00 AM every 3 days
export const FlushFilesJob = isProduction
    ? cron.createTask('0 1 */3 * *', './scripts/flushFiles.script.js', { timezone: 'Asia/Kolkata' })
    : cron.createTask('0 1 */3 * *', flushFilesTask, { timezone: 'Asia/Kolkata' });
