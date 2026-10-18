import Logger from './shared/configs/logger.js';

Logger.info('Lookit worker entrypoint — queues will be wired in Phase 1');
// Keep process alive for now so container healthchecks can target this entry later.
setInterval(() => {}, 60_000);
