import logger from './logger.js';

/**
 * Custom fetch error carrying status and timeout flags.
 */
export class HttpFetchError extends Error {
  constructor(message, { status = null, isTimeout = false, originalError = null } = {}) {
    super(message);
    this.name = 'HttpFetchError';
    this.status = status;
    this.isTimeout = isTimeout;
    this.originalError = originalError;
  }
}

/**
 * Robust HTTP client using native fetch with AbortController timeout and single retry.
 *
 * @param {string} url - Target URL
 * @param {object} options
 * @param {string} [options.method='GET'] - HTTP method
 * @param {Record<string, string>} [options.headers={}] - Request headers
 * @param {any} [options.body] - Request body (JSON string or FormData/Buffer)
 * @param {number} [options.timeoutMs=15000] - Request timeout in milliseconds
 * @param {number} [options.retries=1] - Maximum retries (default 1)
 * @param {number} [options.retryDelayMs=1000] - Backoff delay before retry (default 1000ms)
 * @param {number[]} [options.retryStatuses=[503]] - Status codes to retry on
 * @returns {Promise<Response>}
 */
export async function httpClient(url, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body = null,
    timeoutMs = 15000,
    retries = 1,
    retryDelayMs = 1000,
    retryStatuses = [503],
  } = options;

  let attempt = 0;
  const maxAttempts = 1 + Math.max(0, retries);

  while (attempt < maxAttempts) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timer);

      // Retry only on specific transient status codes (e.g., 503)
      if (retryStatuses.includes(response.status) && attempt < maxAttempts) {
        logger.warn(
          { url, status: response.status, attempt, maxAttempts },
          `Transient HTTP ${response.status} received; retrying in ${retryDelayMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        continue;
      }

      return response;
    } catch (err) {
      clearTimeout(timer);

      const isAbort = err.name === 'AbortError';

      // If aborted by timeout and attempts remaining
      if (isAbort) {
        if (attempt < maxAttempts) {
          logger.warn(
            { url, attempt, timeoutMs },
            `Request timed out after ${timeoutMs}ms; retrying once...`
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          continue;
        }
        throw new HttpFetchError(`Request to ${url} timed out after ${timeoutMs}ms`, {
          isTimeout: true,
          originalError: err,
        });
      }

      // If network/connection error and attempts remaining
      if (attempt < maxAttempts) {
        logger.warn(
          { url, attempt, error: err.message },
          `Network error occurred; retrying in ${retryDelayMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        continue;
      }

      throw new HttpFetchError(`Network error connecting to ${url}: ${err.message}`, {
        isTimeout: false,
        originalError: err,
      });
    }
  }

  throw new HttpFetchError(`Failed to fetch ${url} after ${maxAttempts} attempts`);
}

export default httpClient;

