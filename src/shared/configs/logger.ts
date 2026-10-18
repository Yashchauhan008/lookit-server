import winston from 'winston';
import env from '@/shared/configs/env.js';

const config  = {
    customLevels: {
        levels: {
            false: -1,
            error: 0,
            warn: 1,
            info: 2,
            http: 3,
            verbose: 4,
            debug: 5,
            silly: 6,
        },
        colors: {
            error: 'red',
            warn: 'yellow',
            info: 'green',
            http: 'blue',
            verbose: 'cyan',
            debug: 'magenta',
            silly: 'white',
        },
    },
};


const { format, transports } = winston;
const {
    combine, timestamp, printf, colorize, uncolorize
} = format;

// Add custom levels and colors
winston.addColors(config.customLevels.colors);

// Time Stamp formate for logs
const TS = timestamp({ format: 'YYYY-MM-DD HH:mm:ss' });

// Log formate for console (different for transports)
const consoleFormate = {
    pretty: printf((info) => `${info.level} : ${info.message} ${info.stack ? `\n ${info.stack}` : ''}`),
    json: printf((info) => `{
    "timestamp": "${info.timestamp}",
    "level": "${info.level}",
    "service":"${info.service}",
    "message":"${info.message?.toString().trim()}",
    "stack": "${info.stack ? info.stack : ''}"
  },`),
};

// Log options for console
const consoleLogOptions = {
    level: env.CONSOLE_LOG_LEVEL,
    handleExceptions: true,
    format: combine(TS, env.ENV === 'development' ? colorize() : uncolorize(), consoleFormate.pretty),
};

// Log options for file
const fileLogOptions = {
    level: env.FILE_LOG_LEVEL,
    filename: 'logs/combine.log',
    maxSize: '1m',
    format: combine(TS, consoleFormate.json),
};

const logger = winston.createLogger({
    levels: config.customLevels.levels,
    defaultMeta: { service: env.SERVICE_NAME },
    transports: [
        new transports.Console(consoleLogOptions),
        new transports.File(fileLogOptions),
    ],
});

export default logger;
