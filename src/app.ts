import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import Logger from './shared/configs/logger.js';
import errorHandler from './shared/middlewares/error-handler.js';
import appRoute from './app.route.js';
import RedisClient from './shared/configs/redis.js';

import env from './shared/configs/env.js';

const app = express();

app.use(
    morgan(':method :url Status : :status, Time taken: :response-time ms', {
        stream: { write: (message) => Logger.info(message) },
    }),
);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
const serverStartTimeStamp = new Date().toISOString();

// Status route
app.get('/', (req, res) => {
    res.status(200).json({
        status: 'OK',
        version: '1.0.0',
        startTime: serverStartTimeStamp,
        service: env.SERVICE_NAME,
        codeSign: 'R.P.Raiyani',
        author: 'rajraiyani.com',
    });
});

app.get('/ping', (req, res) => {
    res.status(200).send('pont');
});

app.use('/', appRoute);

// Error handler
app.use(errorHandler);

RedisClient.connect()
    .then(() => {
        Logger.info('Redis connected successfully ✅');
    })
    .catch((error) => {
        Logger.error('Redis connection error', error);
    });

export default app;
