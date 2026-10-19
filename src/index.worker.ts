import Logger from './shared/configs/logger.js';
import { startProcessPhotoWorker } from './modules/uploads/workers/process-photo.worker.js';
import { startIndexFacesWorker } from './modules/faces/workers/index-faces.worker.js';

Logger.info('Lookit worker starting');
startProcessPhotoWorker();
startIndexFacesWorker();
