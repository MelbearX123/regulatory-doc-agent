import { startAgent } from './agent/listener';
import { logger } from './core/logger';

// Anything unexpected ends the process; the restart policy (see README) brings it back.
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled rejection; exiting');
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception; exiting');
  process.exit(1);
});

try {
  await startAgent();
} catch (err) {
  logger.fatal({ err }, 'Agent failed to start');
  process.exit(1);
}
