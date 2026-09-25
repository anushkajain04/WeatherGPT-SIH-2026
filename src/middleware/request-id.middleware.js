import crypto from 'crypto';
import logger from '../utils/logger.js';

/**
 * Attaches a unique request ID and a contextual child logger to each incoming request.
 */
export function requestIdMiddleware(req, res, next) {
  const reqId = req.headers['x-request-id'] || crypto.randomUUID();

  req.id = reqId;
  res.setHeader('X-Request-ID', reqId);

  // Attach contextual child logger for this request
  req.log = logger.child({ reqId });
  req.startTime = Date.now();

  next();
}

export default requestIdMiddleware;

