import pino from 'pino';
import env from '../config/env.js';

const isDev = env.NODE_ENV === 'development';

/**
 * Pino logger configured with strict secret redaction.
 * No API key, token, credential, or sensitive header will ever be written to logs.
 */
export const logger = pino({
  level: isDev ? 'debug' : 'info',
  redact: {
    paths: [
      // Standard HTTP header redactions
      'req.headers.authorization',
      'req.headers["authorization"]',
      'req.headers.ulcaapikey',
      'req.headers["ulcaapikey"]',
      'req.headers["ulcaApiKey"]',
      'req.headers["x-internal-api-key"]',
      'req.headers["x-api-key"]',
      'req.headers.cookie',
      'req.headers["set-cookie"]',
      'headers.authorization',
      'headers.ulcaApiKey',
      'headers.ulcaapikey',
      'headers["X-Internal-API-Key"]',
      'headers["x-internal-api-key"]',
      'headers["X-API-Key"]',
      'headers["x-api-key"]',
      // Body and query credential redactions
      '*.authorization',
      '*.ulcaApiKey',
      '*.ulcaapikey',
      '*.apiKey',
      '*.api_key',
      '*.token',
      '*.secret',
      '*.password',
      '*["x-internal-api-key"]',
      '*["x-api-key"]',
    ],
    censor: '[REDACTED]',
  },
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    service: 'weathergpt-backend',
    env: env.NODE_ENV,
  },
});

export default logger;

