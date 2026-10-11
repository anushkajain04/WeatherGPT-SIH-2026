import app from './app.js';
import env from './config/env.js';
import logger from './utils/logger.js';
import { connectDB, disconnectDB } from './config/db.js';
import keepWarmService from './services/keep-warm.service.js';
import cacheService from './services/cache.service.js';

const port = env.PORT;

let server;

async function startServer() {
  try {
    // 1. Establish database connection and synchronize indexes
    await connectDB();

    // 2. Start HTTP server
    server = app.listen(port, () => {
      logger.info(
        { port, nodeEnv: env.NODE_ENV },
        `WeatherGPT Backend service is running on port ${port}`
      );

      // Start background keep-warm worker if enabled
      keepWarmService.start();

      if (!env.OPENWEATHER_API_KEY || env.OPENWEATHER_API_KEY === 'your_openweather_api_key_here') {
        logger.warn(
          'OPENWEATHER_API_KEY is not configured or is a placeholder. Dashboard weather endpoints will return 503 WEATHER_NOT_CONFIGURED.'
        );
      }
    });
  } catch (err) {
    logger.fatal({ error: err.message }, 'Failed to start server due to startup error');
    process.exit(1);
  }
}

startServer();

/**
 * Graceful shutdown handler for SIGTERM and SIGINT.
 */
function gracefulShutdown(signal) {
  logger.info({ signal }, `${signal} received. Initiating graceful shutdown...`);

  if (!server) {
    disconnectDB().finally(() => process.exit(0));
    return;
  }

  // Stop accepting new connections
  server.close(async (err) => {
    if (err) {
      logger.error({ err: err.message }, 'Error during HTTP server close');
      process.exit(1);
    }

    logger.info('HTTP server closed. Stopping auxiliary workers and database...');
    keepWarmService.stop();
    cacheService.destroy();
    await disconnectDB();

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
