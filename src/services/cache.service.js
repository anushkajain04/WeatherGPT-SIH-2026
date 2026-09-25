/**
 * In-memory TTL Cache with a standard interface pluggable to Redis or Memcached later.
 */
export class CacheService {
  constructor(options = {}) {
    this.store = new Map();
    const pruneIntervalMs = options.pruneIntervalMs || 5 * 60 * 1000; // 5 minutes

    // Unref timer so it does not block Node process exit
    this.pruneTimer = setInterval(() => this.prune(), pruneIntervalMs);
    if (this.pruneTimer.unref) {
      this.pruneTimer.unref();
    }
  }

  /**
   * Retrieve a value from the cache if not expired.
   * @param {string} key
   * @returns {any|null}
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Store a value in cache with a TTL.
   * @param {string} key
   * @param {any} value
   * @param {number} ttlMs - Time to live in milliseconds
   */
  set(key, value, ttlMs) {
    if (!key || ttlMs <= 0) return;

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Check if a valid (non-expired) key exists.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Delete a key from cache.
   * @param {string} key
   * @returns {boolean}
   */
  del(key) {
    return this.store.delete(key);
  }

  /**
   * Clear all entries.
   */
  clear() {
    this.store.clear();
  }

  /**
   * Remove expired keys to free memory.
   */
  prune() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Return count of active items in cache.
   * @returns {number}
   */
  size() {
    return this.store.size;
  }

  /**
   * Clean up timer on shutdown.
   */
  destroy() {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
    }
    this.clear();
  }
}

// Global default cache instance
export const cacheService = new CacheService();
export default cacheService;

