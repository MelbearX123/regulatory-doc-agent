import pino from 'pino';
import { appConfig } from './config';

/** Pretty, colourised logs locally; plain JSON lines when LOG_PRETTY=false (e.g. in Docker). */
export const logger = pino({
  level: appConfig.logLevel,
  ...(appConfig.prettyLogs && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  }),
});
