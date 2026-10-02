import jwt from 'jsonwebtoken';
import env from '../../config/env.js';
import { AuthError } from '../../utils/errors.js';

const JWT_ALGORITHM = 'HS256';
const TOKEN_EXPIRY = '7d';

/**
 * Generates a 7-day JWT session token with user ID as subject.
 *
 * @param {string|object} userId
 * @returns {string} Signed JWT
 */
export function generateSessionToken(userId) {
  const sub = typeof userId === 'object' && userId._id ? userId._id.toString() : userId.toString();
  return jwt.sign({ sub }, env.JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: TOKEN_EXPIRY,
  });
}

/**
 * Verifies JWT session token, strictly pinning the algorithm to HS256.
 *
 * @param {string} token
 * @returns {{ sub: string, iat: number, exp: number }}
 */
export function verifySessionToken(token) {
  if (!token) {
    throw new AuthError('Authentication token missing.');
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
    });
    return decoded;
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AuthError('Session token has expired. Please log in again.');
    }
    throw new AuthError('Invalid session token.');
  }
}

export default { generateSessionToken, verifySessionToken };
