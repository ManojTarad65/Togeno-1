import app from './app';
import { env } from './config';
import { logger } from './utils/logger';
import { startAutomationJobs } from './jobs/automation.job';

const PORT = Number.parseInt(env.PORT, 10);

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} [${env.NODE_ENV}]`);
  startAutomationJobs();
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  server.close(() => process.exit(1));
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => process.exit(0));
});
