import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';

import env from './config/env.js';
import requestIdMiddleware from './middleware/request-id.middleware.js';
import errorHandler from './middleware/error-handler.middleware.js';
import { NotFoundError } from './utils/errors.js';

import healthRouter from './routes/health.routes.js';
import chatRouter from './routes/chat.routes.js';
import ttsRouter from './routes/tts.routes.js';

export const app = express();

// 1. Security Headers via Helmet
app.use(helmet());

// 2. CORS restricted strictly to parsed allowlist (never wildcard)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, mobile clients, server-to-server)
      if (!origin) return callback(null, true);

      if (env.ALLOWED_ORIGINS_LIST.includes(origin)) {
        return callback(null, true);
      }

      const corsError = new Error(`Origin '${origin}' is not permitted by CORS policy.`);
      corsError.statusCode = 403;
      return callback(corsError);
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-API-Key', 'Accept'],
  })
);

// 3. Response Compression
app.use(compression());

// 4. Request Body Parsing (strictly capped at 10KB to prevent payload flooding)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 5. Request Tracking (UUID and contextual child logger)
app.use(requestIdMiddleware);

// 6. Route Mounting under /api
app.use('/api', healthRouter);
app.use('/api', chatRouter);
app.use('/api', ttsRouter);

// 7. 404 Fallback for unmatched routes
app.use((req, res, next) => {
  next(new NotFoundError(`Endpoint ${req.method} ${req.originalUrl} not found`));
});

// 8. Global Centralized Error Handler (must be last middleware)
app.use(errorHandler);

export default app;

