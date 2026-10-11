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

/**
 * Helper to select the most relevant city/town/village name from an address object,
 * stripping trailing administrative designations (Tahsil, Tehsil, Taluka, Taluk, Mandal, Block).
 *
 * @param {object} address
 * @returns {string|null}
 */
function extractPlaceName(address) {
  if (!address || typeof address !== 'object') return null;
  const raw =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.state_district ||
    address.county ||
    null;
  if (!raw) return null;
  const cleaned = raw.trim().replace(/\s+(?:Tahsil|Tehsil|Taluka|Taluk|Mandal|Block|District)$/i, '').trim();
  return cleaned || raw.trim();
}

export class GeocodingService {
  /**
   * Reverse-geocodes coordinates into a clean city, state, formatted label, and lat/lon.
   *
   * @param {number} lat - Latitude (-90 to 90)
   * @param {number} lon - Longitude (-180 to 180)
   * @returns {Promise<{ city: string, state: string | null, formatted: string, lat: number, lon: number }>}
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
    const city = extractPlaceName(address);
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
      lat: Number(data.lat != null ? data.lat : lat),
      lon: Number(data.lon != null ? data.lon : lon),
    };

    geocodingCache.set(cacheKey, result, CACHE_TTL_MS);
    return result;
  }

  /**
   * Forward-geocodes an Indian postal code (pincode) into city, state, formatted label, and lat/lon.
   *
   * @param {string} pincode - 6-digit postal code
   * @returns {Promise<{ city: string, state: string | null, formatted: string, lat: number, lon: number }>}
   */
  async resolvePincode(pincode) {
    const cleanPin = String(pincode).trim();
    const cacheKey = `pincode:${cleanPin}`;
    const cached = geocodingCache.get(cacheKey);

    if (cached) {
      logger.debug({ cacheKey, result: cached }, 'Pincode geocoding cache hit');
      return cached;
    }

    const contactEmail = env.GEOCODING_CONTACT_EMAIL || 'contact@weathergpt.local';
    const userAgent = `WeatherGPT-SIH-2026/1.0 (contact: ${contactEmail})`;
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(cleanPin)}&country=India&format=jsonv2&accept-language=en&addressdetails=1`;

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
          { status: response.status, pincode: cleanPin },
          'Nominatim pincode geocoding upstream returned non-200 status'
        );
        throw new NotFoundError('Unable to resolve location for the provided pincode.');
      }

      data = await response.json();
    } catch (err) {
      if (err instanceof NotFoundError) {
        throw err;
      }

      logger.warn(
        { pincode: cleanPin, error: err.message, isTimeout: err.isTimeout },
        'Nominatim pincode search request failed or timed out'
      );
      throw new NotFoundError('Unable to resolve location for the provided pincode.');
    }

    if (!Array.isArray(data) || data.length === 0) {
      logger.info({ pincode: cleanPin }, 'Nominatim returned empty result for pincode');
      throw new NotFoundError('No city found for the provided pincode.');
    }

    const firstResult = data[0];
    const address = firstResult.address || {};
    const city = extractPlaceName(address);
    const state = address.state || null;

    if (!city) {
      logger.info({ address, pincode: cleanPin }, 'No usable city-level field in Nominatim pincode response');
      throw new NotFoundError('No city found for the provided pincode.');
    }

    const formatted =
      state && state.toLowerCase() !== city.toLowerCase()
        ? `${city}, ${state}`
        : city;

    const result = {
      city,
      state: state || null,
      formatted,
      lat: Number(firstResult.lat),
      lon: Number(firstResult.lon),
    };

    geocodingCache.set(cacheKey, result, CACHE_TTL_MS);
    return result;
  }

  /**
   * Searches places across India using Open-Meteo Geocoding API.
   *
   * @param {string} query - 3 to 60 characters search term
   * @returns {Promise<Array<{ label: string, name: string, state: string | null, lat: number, lon: number }>>}
   */
  async searchPlaces(query) {
    const cleanQuery = String(query).trim().toLowerCase();
    const cacheKey = `search:${cleanQuery}`;
    const cached = geocodingCache.get(cacheKey);

    if (cached) {
      logger.debug({ cacheKey, resultCount: cached.length }, 'Place search cache hit');
      return cached;
    }

    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanQuery)}&count=8&language=en&format=json&countryCode=IN`;

    let data;
    try {
      const response = await httpClient(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        timeoutMs: 5000,
        retries: 1,
      });

      if (!response.ok) {
        logger.warn(
          { status: response.status, query: cleanQuery },
          'Open-Meteo place search upstream returned non-200 status'
        );
        throw new AppError('Geocoding service unavailable.', 502, 'GEOCODING_UNAVAILABLE');
      }

      data = await response.json();
    } catch (err) {
      if (err instanceof AppError) throw err;

      logger.warn(
        { query: cleanQuery, error: err.message, isTimeout: err.isTimeout },
        'Open-Meteo place search request failed or timed out'
      );
      throw new AppError('Geocoding service unavailable.', 502, 'GEOCODING_UNAVAILABLE');
    }

    const rawList = Array.isArray(data?.results) ? data.results : [];
    const results = [];
    const seen = new Set();

    for (const item of rawList) {
      const name = (item.name || '').trim();
      const state = (item.admin1 || item.state || null)?.trim() || null;
      if (!name) continue;

      // Filter to Latin-only characters
      const isLatin = /^[A-Za-z0-9\s,.'()-]+$/.test(name) && (!state || /^[A-Za-z0-9\s,.'()-]+$/.test(state));
      if (!isLatin) continue;

      const label = state && state.toLowerCase() !== name.toLowerCase() ? `${name}, ${state}` : name;
      const lat = Number(Number(item.latitude).toFixed(4));
      const lon = Number(Number(item.longitude).toFixed(4));
      const dedupKey = `${label.toLowerCase()}:${lat}:${lon}`;

      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      results.push({
        label,
        name,
        state: state || null,
        lat,
        lon,
      });

      if (results.length >= 8) break;
    }

    geocodingCache.set(cacheKey, results, CACHE_TTL_MS);
    return results;
  }
}

export const geocodingService = new GeocodingService();
export default geocodingService;
