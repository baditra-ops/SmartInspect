import crypto from "crypto";
import { redisClient, getRedisStatus } from "../config/redis.js";

/**
 * Default cache TTLs in seconds
 */
export const CACHE_TTL = {
  SHORT: 30,       // 30 seconds for rapidly changing queries
  STANDARD: 60,    // 60 seconds (default for lists and details)
  EXTENDED: 120,   // 2 minutes for slow-changing reference data
};

/**
 * Safely serialize any JavaScript value, supporting Prisma BigInt, Decimal, and Date
 * @param {*} data 
 * @returns {string} JSON string
 */
export const safeSerialize = (data) => {
  return JSON.stringify(data, (key, value) => {
    // Handle BigInt
    if (typeof value === "bigint") {
      return value.toString();
    }
    // Handle Prisma Decimal objects or custom Decimal types
    if (value && typeof value === "object" && typeof value.toFixed === "function") {
      return Number(value.toString());
    }
    return value;
  });
};

/**
 * Safely parse JSON string
 * @param {string|null} raw 
 * @returns {*|null} Parsed object or null
 */
export const safeDeserialize = (raw) => {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[Cache] Deserialization error: ${err.message}`);
    }
    return null;
  }
};

/**
 * Generate a deterministic hash for complex query objects
 * @param {object} obj 
 * @returns {string} 8-character hex hash
 */
export const hashObject = (obj = {}) => {
  if (!obj || Object.keys(obj).length === 0) return "all";
  const sortedKeys = Object.keys(obj).sort();
  const sortedObj = {};
  for (const key of sortedKeys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      sortedObj[key] = obj[key];
    }
  }
  return crypto.createHash("md5").update(JSON.stringify(sortedObj)).digest("hex").substring(0, 12);
};

/**
 * Build a deterministic namespaced cache key incorporating user scope and parameters
 * @param {string} entity 'institutions' | 'inspections' | etc.
 * @param {string} type 'list' | 'detail' | 'stats'
 * @param {object} scope { role, state, district, institutionId, userId }
 * @param {string|object} identifierOrQuery ID or query object
 * @returns {string} Namespaced cache key
 */
export const buildCacheKey = (entity, type, scope = {}, identifierOrQuery = "") => {
  const role = scope.role || "PUBLIC";
  const state = (scope.state || "all").toLowerCase().replace(/\s+/g, "_");
  const district = (scope.district || "all").toLowerCase().replace(/\s+/g, "_");
  const instId = scope.institutionId || "all";
  const userId = scope.userId || "all";

  let queryPart = "";
  if (typeof identifierOrQuery === "object") {
    queryPart = hashObject(identifierOrQuery);
  } else if (identifierOrQuery) {
    queryPart = String(identifierOrQuery);
  }

  return `${entity}:${type}:${role}:${state}:${district}:${instId}:${userId}:${queryPart}`.replace(/:+$/, "");
};

/**
 * Cache Service
 * Wraps redisClient with graceful offline fallbacks and error handling
 */
class CacheService {
  /**
   * Check if Redis is currently available and ready
   * @returns {boolean}
   */
  isAvailable() {
    try {
      return Boolean(redisClient && redisClient.isOpen);
    } catch {
      return false;
    }
  }

  /**
   * Get cached item by key
   * @param {string} key 
   * @returns {Promise<*|null>}
   */
  async get(key) {
    if (!this.isAvailable() || !key) return null;
    try {
      const raw = await redisClient.get(key);
      return safeDeserialize(raw);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[Cache] GET failed for key "${key}": ${err.message}`);
      }
      return null;
    }
  }

  /**
   * Set cached item with TTL (in seconds)
   * @param {string} key 
   * @param {*} value 
   * @param {number} ttlSeconds Default: 60s
   * @returns {Promise<boolean>}
   */
  async set(key, value, ttlSeconds = CACHE_TTL.STANDARD) {
    if (!this.isAvailable() || !key || value === undefined) return false;
    try {
      const serialized = safeSerialize(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await redisClient.set(key, serialized, { EX: ttlSeconds });
      } else {
        await redisClient.set(key, serialized);
      }
      return true;
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[Cache] SET failed for key "${key}": ${err.message}`);
      }
      return false;
    }
  }

  /**
   * Delete single key or array of keys
   * @param {string|string[]} keys 
   * @returns {Promise<number>} Number of keys deleted
   */
  async del(keys) {
    if (!this.isAvailable() || !keys) return 0;
    try {
      if (Array.isArray(keys)) {
        if (keys.length === 0) return 0;
        return await redisClient.del(keys);
      }
      return await redisClient.del(keys);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[Cache] DEL failed for keys: ${err.message}`);
      }
      return 0;
    }
  }

  /**
   * Invalidate all keys matching a glob pattern using SCAN
   * Safe for production (does not block event loop like KEYS)
   * @param {string} pattern Example: 'institutions:list:*'
   * @returns {Promise<number>} Count of deleted keys
   */
  async delByPattern(pattern) {
    if (!this.isAvailable() || !pattern) return 0;
    try {
      let totalDeleted = 0;
      const batch = [];

      for await (const key of redisClient.scanIterator({ MATCH: pattern, COUNT: 50 })) {
        batch.push(key);
        if (batch.length >= 50) {
          totalDeleted += await redisClient.del(batch);
          batch.length = 0;
        }
      }

      if (batch.length > 0) {
        totalDeleted += await redisClient.del(batch);
      }

      return totalDeleted;
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[Cache] DEL by pattern failed for "${pattern}": ${err.message}`);
      }
      return 0;
    }
  }

  /**
   * Check if a key exists
   * @param {string} key 
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    if (!this.isAvailable() || !key) return false;
    try {
      const count = await redisClient.exists(key);
      return count > 0;
    } catch (err) {
      return false;
    }
  }

  /**
   * Cache-Aside Helper: Read from cache, or execute fetcher function and populate cache
   * @param {string} key 
   * @param {Function} fetcher Async function returning fresh data
   * @param {number} ttlSeconds 
   * @returns {Promise<*>}
   */
  async getOrSet(key, fetcher, ttlSeconds = CACHE_TTL.STANDARD) {
    // 1. Attempt Cache HIT
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    // 2. Cache MISS -> Query Database / Source of Truth
    const freshData = await fetcher();

    // 3. Populate Cache asynchronously without delaying response
    if (freshData !== null && freshData !== undefined) {
      this.set(key, freshData, ttlSeconds).catch(() => {});
    }

    return freshData;
  }

  /**
   * Get Redis Status summary
   */
  getStatus() {
    return getRedisStatus();
  }
}

export const cacheService = new CacheService();
export default cacheService;
