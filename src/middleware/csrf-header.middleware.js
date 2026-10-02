import { ForbiddenError } from '../utils/errors.js';

/**
 * CSRF Protection Middleware.
 * Enforces custom header 'X-Requested-With: WeatherGPT' on all mutating requests (POST, PATCH, PUT, DELETE).
 * Protects cross-origin deployments when SameSite=None cookies are utilized.
 */
export function csrfHeaderMiddleware(req, res, next) {
  const mutatingMethods = ['POST', 'PATCH', 'PUT', 'DELETE'];

  if (mutatingMethods.includes(req.method.toUpperCase())) {
    const headerValue = req.headers['x-requested-with'];

    if (headerValue !== 'WeatherGPT') {
      return next(
        new ForbiddenError(
          'CSRF protection: Header "X-Requested-With: WeatherGPT" is required on state-changing requests.'
        )
      );
    }
  }

  next();
}

export default csrfHeaderMiddleware;
