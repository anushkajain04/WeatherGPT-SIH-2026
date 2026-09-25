import env from '../config/env.js';
import { CACHE_TTLS } from '../config/constants.js';
import cacheService from './cache.service.js';
import httpClient, { HttpFetchError } from '../utils/http-client.js';
import { RAGServiceError } from '../utils/errors.js';
import logger from '../utils/logger.js';

const RAG_CACHE_PREFIX = 'rag:answer:';
const RAG_HEALTH_CACHE_KEY = 'rag:health:status';

export class RAGService {
  constructor() {
    this.lastSuccessfulContact = 0;
    this.warmWindowMs = 10 * 60 * 1000; // Consider warm if contacted in last 10 minutes
  }

  /**
   * Determine whether the upstream service is warm or cold.
   * @returns {boolean}
   */
  isWarm() {
    return Date.now() - this.lastSuccessfulContact < this.warmWindowMs;
  }

  /**
   * Normalize strings for deterministic cache keys.
   */
  normalizeKeyPart(str) {
    return (str || '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  /**
   * Ping upstream RAG service /health endpoint with caching to avoid hammering.
   * @returns {Promise<{ status: 'ok' | 'degraded' | 'down', latencyMs: number }>}
   */
  async checkHealth() {
    const cachedHealth = cacheService.get(RAG_HEALTH_CACHE_KEY);
    if (cachedHealth) return cachedHealth;

    const start = Date.now();
    const url = `${env.RAG_BASE_URL}/health`;

    try {
      const res = await httpClient(url, {
        method: 'GET',
        timeoutMs: 15000,
        retries: 1,
      });

      const latencyMs = Date.now() - start;

      if (res.ok) {
        this.lastSuccessfulContact = Date.now();
        const healthResult = { status: 'ok', latencyMs };
        cacheService.set(RAG_HEALTH_CACHE_KEY, healthResult, CACHE_TTLS.HEALTH_STATUS_TTL_MS);
        return healthResult;
      }

      const degradedResult = { status: 'degraded', latencyMs };
      cacheService.set(RAG_HEALTH_CACHE_KEY, degradedResult, CACHE_TTLS.HEALTH_STATUS_TTL_MS);
      return degradedResult;
    } catch (err) {
      const latencyMs = Date.now() - start;
      const downResult = { status: 'down', latencyMs };
      cacheService.set(RAG_HEALTH_CACHE_KEY, downResult, CACHE_TTLS.HEALTH_STATUS_TTL_MS);
      return downResult;
    }
  }

  /**
   * Sends query, role, and location to upstream Python RAG service.
   *
   * @param {object} params
   * @param {string} params.query - Must be in English
   * @param {string} [params.role='normal_user']
   * @param {string} [params.location] - Unmodified Latin-script geolocation string
   * @returns {Promise<{ answer: string, route: string, model_used: string, latency_seconds: number, location_resolved: any, isCached?: boolean }>}
   */
  async queryRAG({ query, role = 'normal_user', location = '' }) {
    const normLocation = this.normalizeKeyPart(location);
    const normQuery = this.normalizeKeyPart(query);
    const cacheKey = `${RAG_CACHE_PREFIX}${normLocation}:${normQuery}:${role}`;

    // Check 10-minute cache to conserve LLM quota
    const cachedResponse = cacheService.get(cacheKey);
    if (cachedResponse) {
      logger.debug({ location, query }, 'RAG answer served from 10m cache');
      return { ...cachedResponse, isCached: true };
    }

    const warm = this.isWarm();
    const timeoutMs = warm ? env.RAG_WARM_TIMEOUT_MS : env.RAG_COLD_TIMEOUT_MS;

    logger.debug(
      { isWarm: warm, timeoutMs, location, role },
      'Sending request to upstream RAG service...'
    );

    const url = `${env.RAG_BASE_URL}/chat`;
    const payload = {
      query,
      role,
      location: location || undefined,
    };

    try {
      const response = await httpClient(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': env.RAG_API_KEY,
        },
        body: JSON.stringify(payload),
        timeoutMs,
        retries: 1,
        retryStatuses: [503], // Retry once on 503; never on 400 or 401
      });

      if (!response.ok) {
        const status = response.status;
        logger.warn(
          { status, location },
          `Upstream RAG returned error HTTP ${status}`
        );

        if (status === 401) {
          logger.error('CRITICAL: Internal RAG API key was rejected by upstream service (401).');
          throw new RAGServiceError({ upstreamStatus: 401 });
        } else if (status === 400) {
          throw new RAGServiceError({ upstreamStatus: 400 });
        } else if (status === 503) {
          throw new RAGServiceError({ upstreamStatus: 503 });
        }

        throw new RAGServiceError({ upstreamStatus: status });
      }

      const data = await response.json();
      this.lastSuccessfulContact = Date.now();

      const result = {
        answer: data.answer,
        route: data.route || 'rag',
        model_used: data.model_used || 'unknown',
        latency_seconds: data.latency_seconds || 0,
        location_resolved: data.location_resolved || null,
      };

      // Cache valid RAG response for ~10 minutes
      cacheService.set(cacheKey, result, CACHE_TTLS.RAG_ANSWER_TTL_MS);

      return result;
    } catch (err) {
      if (err instanceof RAGServiceError) throw err;

      if (err instanceof HttpFetchError && err.isTimeout) {
        logger.warn({ timeoutMs }, 'Upstream RAG request timed out (cold start asleep)');
        throw new RAGServiceError({ isTimeout: true });
      }

      logger.error({ error: err.message }, 'Failed to communicate with RAG upstream');
      throw new RAGServiceError({
        upstreamStatus: 502,
        internalMessage: err.message,
      });
    }
  }
}

export const ragService = new RAGService();
export default ragService;

