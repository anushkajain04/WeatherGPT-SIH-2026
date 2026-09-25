import rateLimit from 'express-rate-limit';
import env from '../config/env.js';
import { RateLimitError } from '../utils/errors.js';

/**
 * IP-based rate limiter for chat endpoints.
 * Configured via CHAT_RATE_LIMIT_WINDOW_MS and CHAT_RATE_LIMIT_MAX.
 */
export const chatRateLimiter = rateLimit({
  windowMs: env.CHAT_RATE_LIMIT_WINDOW_MS,
  max: env.CHAT_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(
      new RateLimitError(
        `Rate limit exceeded: You can only make ${env.CHAT_RATE_LIMIT_MAX} requests per ${Math.round(
          env.CHAT_RATE_LIMIT_WINDOW_MS / 60000
        )} minutes.`
      )
    );
  },
});

export default chatRateLimiter;

