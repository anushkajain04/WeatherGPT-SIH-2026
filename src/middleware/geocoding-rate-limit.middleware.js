import rateLimit from 'express-rate-limit';
import { RateLimitError } from '../utils/errors.js';

/**
 * IP-based rate limiter for reverse geocoding route.
 * Protects third-party Nominatim OpenStreetMap rate limits (max 1 req/sec).
 */
export const geocodingRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 30,             // 30 requests per minute per IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(
      new RateLimitError(
        'Too many location resolution requests. Please slow down and try again.'
      )
    );
  },
});

export default geocodingRateLimiter;
