import * as winston from 'winston';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import DailyRotateFile = require('winston-daily-rotate-file');
import LokiTransport = require('winston-loki');
import { maskSensitiveData } from '../common/utils/masking.util';

export const loggerConfig = {
  levels: {
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
    http: 'magenta',
    verbose: 'cyan',
    debug: 'blue',
    silly: 'gray',
  },
};

winston.addColors(loggerConfig.colors);

const maskingFormat = winston.format((info) => {
  const masked = maskSensitiveData(info);
  return { ...info, ...masked };
});

const getTransports = () => {
  const transports: winston.transport[] = [
    new winston.transports.Console({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        nestWinstonModuleUtilities.format.nestLike('DABDUB', {
          colors: true,
          prettyPrint: true,
        }),
      ),
    }),
  ];

  if (process.env.LOKI_HOST) {
    transports.push(
      new LokiTransport({
        host: process.env.LOKI_HOST,
        labels: { app: 'dabdub-backend', env: process.env.NODE_ENV },
        json: true,
        format: winston.format.json(),
        replaceTimestamp: true,
        onConnectionError: (err) => console.error(err),
      }),
    );
  }

  if (process.env.NODE_ENV === 'production') {
    transports.push(
      new DailyRotateFile({
        filename: 'logs/application-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
      new DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
    );
  }

  return transports;
};

export const winstonOptions: winston.LoggerOptions = {
  levels: loggerConfig.levels,
  format: winston.format.combine(
    winston.format.timestamp(),
    maskingFormat(),
    winston.format.json(),
  ),
  transports: getTransports(),
  exceptionHandlers: [
    new DailyRotateFile({
      filename: 'logs/exceptions-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: 'logs/rejections-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
};
