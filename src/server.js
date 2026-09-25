import app from './app.js';
import env from './config/env.js';
import logger from './utils/logger.js';
import keepWarmService from './services/keep-warm.service.js';
import cacheService from './services/cache.service.js';

const port = env.PORT;

const server = app.listen(port, () => {
  logger.info(
    { port, nodeEnv: env.NODE_ENV },
    `WeatherGPT Backend service is running on port ${port}`
  );

  // Start background keep-warm worker if enabled
  keepWarmService.start();
});

/**
 * Graceful shutdown handler for SIGTERM and SIGINT.
 */
function gracefulShutdown(signal) {
  logger.info({ signal }, `${signal} received. Initiating graceful shutdown...`);

  // Stop accepting new connections
  server.close((err) => {
    if (err) {
      logger.error({ err: err.message }, 'Error during HTTP server close');
      process.exit(1);
    }

    logger.info('HTTP server closed. Stopping auxiliary workers...');
    keepWarmService.stop();
    cacheService.destroy();

    logger.info('Graceful shutdown complete. Exiting.');
    process.exit(0);
  });

  // Force shutdown after 10 seconds if hanging connections persist
  setTimeout(() => {
    logger.error('Forcefully terminating process after graceful shutdown timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.fatal({ err: err.message, stack: err.stack }, 'Uncaught exception detected');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection detected');
});

