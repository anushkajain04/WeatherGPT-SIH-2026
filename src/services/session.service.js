import cacheService from './cache.service.js';
import { CACHE_TTLS } from '../config/constants.js';
import logger from '../utils/logger.js';

const SESSION_CACHE_PREFIX = 'sess:';

/**
 * Session management and follow-up query rewriting.
 * Stores last location, last resolved language, and last 3 turns per sessionId.
 */
export class SessionService {
  /**
   * Retrieve session data or create a new empty session state.
   * @param {string} sessionId
   * @returns {object}
   */
  getSession(sessionId) {
    if (!sessionId) return null;
    const key = `${SESSION_CACHE_PREFIX}${sessionId}`;
    return cacheService.get(key) || {
      sessionId,
      lastLocation: null,
      lastLanguage: null,
      turns: [],
      updatedAt: Date.now(),
    };
  }

  /**
   * Save or update session turn.
   * Keeps at most the last 3 conversation turns.
   *
   * @param {string} sessionId
   * @param {object} turnData
   * @param {string} [turnData.query]
   * @param {string} [turnData.answer]
   * @param {string} [turnData.location]
   * @param {string} [turnData.language]
   */
  saveTurn(sessionId, { query, answer, location, language }) {
    if (!sessionId) return;

    const session = this.getSession(sessionId);
    if (location) session.lastLocation = location;
    if (language) session.lastLanguage = language;

    if (query && answer) {
      session.turns.push({
        query,
        answer,
        timestamp: Date.now(),
      });

      // Keep only the last 3 turns
      if (session.turns.length > 3) {
        session.turns = session.turns.slice(-3);
      }
    }

    session.updatedAt = Date.now();
    const key = `${SESSION_CACHE_PREFIX}${sessionId}`;
    cacheService.set(key, session, CACHE_TTLS.SESSION_TTL_MS);
  }

  /**
   * Detects follow-up queries and rewrites them into standalone queries using session context.
   *
   * @param {string} sessionId
   * @param {string} query
   * @param {string} [inputLocation]
   * @returns {{ rewrittenQuery: string, effectiveLocation: string|null, isRewritten: boolean }}
   */
  rewriteFollowUp(sessionId, query, inputLocation = null) {
    const session = this.getSession(sessionId);
    let effectiveLocation = inputLocation || (session ? session.lastLocation : null);
    let rewrittenQuery = query.trim();
    let isRewritten = false;

    if (!session || session.turns.length === 0) {
      return { rewrittenQuery, effectiveLocation, isRewritten: false };
    }

    const lowerQuery = rewrittenQuery.toLowerCase();
    const trimmedLen = rewrittenQuery.length;

    // Common follow-up patterns in English and Romanized Hindi
    const isFollowUpPattern =
      /^(what about|how about|and|will it|is it|what is the|aur|kal|kaisa|kya|tapman|humidity|wind)/i.test(
        lowerQuery
      ) || trimmedLen < 40;

    // Check if location is already explicitly mentioned in the query
    const mentionsLocation =
      effectiveLocation && lowerQuery.includes(effectiveLocation.toLowerCase());

    if (isFollowUpPattern && effectiveLocation && !mentionsLocation) {
      // If query is an elliptical follow-up like "what about tomorrow?" or "aur kal ka?",
      // anchor it to the effective location so the downstream RAG can answer accurately.
      if (lowerQuery.endsWith('?')) {
        rewrittenQuery = `${rewrittenQuery.slice(0, -1)} in ${effectiveLocation}?`;
      } else {
        rewrittenQuery = `${rewrittenQuery} in ${effectiveLocation}`;
      }
      isRewritten = true;

      logger.debug(
        { sessionId, originalQuery: query, rewrittenQuery, effectiveLocation },
        'Follow-up query rewritten using session context'
      );
    }

    return {
      rewrittenQuery,
      effectiveLocation,
      isRewritten,
    };
  }
}

export const sessionService = new SessionService();
export default sessionService;

