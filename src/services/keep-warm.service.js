import env from '../config/env.js';
import { TIMEOUTS } from '../config/constants.js';
import httpClient from '../utils/http-client.js';
import logger from '../utils/logger.js';

export class KeepWarmService {
  constructor() {
    this.intervalHandle = null;
    this.isRunning = false;
  }

  /**
   * Ping upstream RAG service health endpoint.
   */
  async ping() {
    const healthUrl = `${env.RAG_BASE_URL}/health`;
    try {
      logger.debug({ url: healthUrl }, 'Keep-warm: Pinging upstream RAG service...');
      const res = await httpClient(healthUrl, {
        method: 'GET',
        timeoutMs: 15000,
        retries: 1,
      });

      if (res.ok) {
        logger.info({ status: res.status }, 'Keep-warm: Upstream RAG is awake and healthy.');
      } else {
        logger.warn({ status: res.status }, 'Keep-warm: Upstream RAG returned non-OK status.');
      }
    } catch (err) {
      logger.warn({ error: err.message }, 'Keep-warm: Failed to ping upstream RAG service.');
    }
  }

  /**
   * Start keep-warm background timer if enabled in env.
   */
  start() {
    if (!env.KEEP_WARM) {
      logger.info('Keep-warm worker is disabled (KEEP_WARM=false).');
      return;
    }

    if (this.isRunning) return;

    this.isRunning = true;
    logger.info(
      { intervalMs: TIMEOUTS.KEEP_WARM_INTERVAL_MS },
      'Keep-warm worker started: Pinging upstream RAG every 10 minutes.'
    );

    // Initial ping
    this.ping();

    this.intervalHandle = setInterval(() => {
      this.ping();
    }, TIMEOUTS.KEEP_WARM_INTERVAL_MS);

    if (this.intervalHandle.unref) {
      this.intervalHandle.unref();
    }
  }

  /**
   * Stop keep-warm timer.
   */
  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.isRunning = false;
    logger.info('Keep-warm worker stopped.');
  }
}

export const keepWarmService = new KeepWarmService();
export default keepWarmService;

