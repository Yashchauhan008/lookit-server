import http from 'http';
import env from './shared/configs/env.js';
import app from './app.js';
import Logger from './shared/configs/logger.js';
import Socket from '@/socket.js';
import { initializeJobs } from './jobs.js';

const server = http.createServer(app);

Socket.init(server);

server.listen(env.PORT, () => {
    Logger.info(`Server is running on port ${env.PORT} in ${env.ENV} mode`);
});

initializeJobs();
