import rateLimit from 'express-rate-limit';
import { RateLimitError } from '../utils/errors.js';

/**
 * IP-based rate limiter for authentication OTP endpoints.
 * Operates accurately behind reverse proxies (Render) via app.set('trust proxy', 1).
 */
export const otpIpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 attempts per 15 minutes per IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(
      new RateLimitError(
        'Too many OTP requests from this network address. Please wait 15 minutes before trying again.'
      )
    );
  },
});

export default otpIpRateLimiter;
