import env from '../config/env.js';
import httpClient, { HttpFetchError } from '../utils/http-client.js';
import { CacheService } from './cache.service.js';
import { NotFoundError } from '../utils/errors.js';
import logger from '../utils/logger.js';

// Dedicated in-memory cache for reverse geocoding with 24h TTL
const geocodingCache = new CacheService({ pruneIntervalMs: 15 * 60 * 1000 });
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Key coordinates rounded to ~3 decimal places (~100m precision)
 * to respect Nominatim rate limit policies and maximize cache hits.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {string}
 */
function getCacheKey(lat, lon) {
  return `${Number(lat).toFixed(3)},${Number(lon).toFixed(3)}`;
}

export class GeocodingService {
  /**
   * Reverse-geocodes coordinates into a clean city, state, and formatted label.
   *
   * @param {number} lat - Latitude (-90 to 90)
   * @param {number} lon - Longitude (-180 to 180)
   * @returns {Promise<{ city: string, state: string | null, formatted: string }>}
   */
  async resolveCity(lat, lon) {
    const cacheKey = getCacheKey(lat, lon);
    const cached = geocodingCache.get(cacheKey);

    if (cached) {
      logger.debug({ cacheKey, result: cached }, 'Reverse geocoding cache hit');
      return cached;
    }

    const contactEmail = env.GEOCODING_CONTACT_EMAIL || 'contact@weathergpt.local';
    const userAgent = `WeatherGPT-SIH-2026/1.0 (contact: ${contactEmail})`;
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=jsonv2&accept-language=en`;

    let data;
    try {
      const response = await httpClient(url, {
        method: 'GET',
        headers: {
          'User-Agent': userAgent,
          Accept: 'application/json',
        },
        timeoutMs: 5000,
        retries: 1,
      });

      if (!response.ok) {
        logger.warn(
          { status: response.status, lat, lon },
          'Nominatim reverse geocoding upstream returned non-200 status'
        );
        throw new NotFoundError('Unable to resolve location for the provided coordinates.');
      }

      data = await response.json();
    } catch (err) {
      if (err instanceof NotFoundError) {
        throw err;
      }

      logger.warn(
        { lat, lon, error: err.message, isTimeout: err.isTimeout },
        'Nominatim reverse geocoding request failed or timed out'
      );
      throw new NotFoundError('Unable to resolve location for the provided coordinates.');
    }

    if (!data || data.error) {
      logger.info({ dataError: data?.error, lat, lon }, 'Nominatim returned error payload or empty result');
      throw new NotFoundError('Unable to resolve location for the provided coordinates.');
    }

    const address = data.address || {};

    // Prefer city, falling back to town, then village, then county
    const city = address.city || address.town || address.village || address.county || null;
    const state = address.state || null;

    if (!city) {
      logger.info({ address, lat, lon }, 'No usable city-level field in Nominatim response');
      throw new NotFoundError('No city found for the provided coordinates.');
    }

    const formatted =
      state && state.toLowerCase() !== city.toLowerCase()
        ? `${city}, ${state}`
        : city;

    const result = {
      city,
      state: state || null,
      formatted,
    };

    geocodingCache.set(cacheKey, result, CACHE_TTL_MS);
    return result;
  }
}

export const geocodingService = new GeocodingService();
export default geocodingService;
