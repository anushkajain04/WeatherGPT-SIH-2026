import env from '../config/env.js';
import { AuthError } from '../utils/errors.js';

/**
 * Optional Client API Key Authentication Middleware.
 * If CLIENT_API_KEY is configured in env, requires client to supply matching 'x-api-key' header.
 * If not configured, acts as a pass-through.
 */
export function authMiddleware(req, res, next) {
  if (!env.CLIENT_API_KEY) {
    return next();
  }

  const clientKey = req.headers['x-api-key'] || req.headers['x-internal-api-key'];

  if (!clientKey || clientKey !== env.CLIENT_API_KEY) {
    return next(new AuthError('Invalid or missing client API key'));
  }

  next();
}

export default authMiddleware;

