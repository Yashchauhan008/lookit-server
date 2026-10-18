import Logger from './shared/configs/logger.js';
import { startProcessPhotoWorker } from './modules/uploads/workers/process-photo.worker.js';

Logger.info('Lookit worker starting');
startProcessPhotoWorker();
