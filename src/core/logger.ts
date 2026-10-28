import pino from 'pino';
import { appConfig } from './config';

export const logger = pino({
  level: appConfig.logLevel,
  ...(appConfig.prettyLogs && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  }),
});
