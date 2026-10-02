import { verifySessionToken } from '../services/auth/token.service.js';
import { findUserById, sanitizeUser } from '../services/auth/user.service.js';
import { AuthError } from '../utils/errors.js';

/**
 * Authentication verification middleware.
 * Verifies the httpOnly 'wgpt_session' cookie, decodes JWT, loads user from database,
 * and attaches sanitized user profile to req.user.
 */
export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.wgpt_session;

    if (!token) {
      throw new AuthError('Authentication required. Session cookie missing.');
    }

    const decoded = verifySessionToken(token);
    const userId = decoded.sub;

    const user = await findUserById(userId);
    req.user = sanitizeUser(user);

    next();
  } catch (err) {
    next(err);
  }
}

export default requireAuth;
