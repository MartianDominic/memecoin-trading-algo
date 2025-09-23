"use strict";
/**
 * High-Performance Memory Cache with TTL
 * Hive Mind Integration - Caching Utility
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalCache = exports.MemoryCache = void 0;
const logger_1 = require("./logger");
class MemoryCache {
    constructor(defaultTtl = 300, // 5 minutes default
    maxSize = 10000, cleanupIntervalMs = 60000 // 1 minute
    ) {
        this.defaultTtl = defaultTtl;
        this.maxSize = maxSize;
        this.cleanupIntervalMs = cleanupIntervalMs;
        this.cache = new Map();
        this.logger = logger_1.Logger.getInstance();
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, cleanupIntervalMs);
    }
    set(key, data, ttl) {
        // Ensure we don't exceed max size
        if (this.cache.size >= this.maxSize) {
            this.evictOldest();
        }
        const entry = {
            data,
            timestamp: new Date(),
            ttl: ttl || this.defaultTtl,
            key
        };
        this.cache.set(key, entry);
        this.logger.debug(`Cache set: ${key}`, {
            key,
            ttl: entry.ttl,
            cacheSize: this.cache.size
        });
    }
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }
        const now = Date.now();
        const age = now - entry.timestamp.getTime();
        if (age > entry.ttl * 1000) {
            this.cache.delete(key);
            this.logger.debug(`Cache expired: ${key}`, { key, age });
            return null;
        }
        this.logger.debug(`Cache hit: ${key}`, { key, age });
        return entry.data;
    }
    has(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return false;
        const now = Date.now();
        const age = now - entry.timestamp.getTime();
        if (age > entry.ttl * 1000) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }
    delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.logger.debug(`Cache deleted: ${key}`);
        }
        return deleted;
    }
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        this.logger.info(`Cache cleared, removed ${size} entries`);
    }
    cleanup() {
        const now = Date.now();
        let cleaned = 0;
        for (const [key, entry] of this.cache.entries()) {
            const age = now - entry.timestamp.getTime();
            if (age > entry.ttl * 1000) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            this.logger.debug(`Cache cleanup completed`, {
                cleaned,
                remaining: this.cache.size
            });
        }
    }
    evictOldest() {
        let oldestKey = null;
        let oldestTime = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp.getTime() < oldestTime) {
                oldestTime = entry.timestamp.getTime();
                oldestKey = key;
            }
        }
        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.logger.debug(`Evicted oldest cache entry: ${oldestKey}`);
        }
    }
    getStats() {
        let oldestTime = null;
        for (const entry of this.cache.values()) {
            if (!oldestTime || entry.timestamp < oldestTime) {
                oldestTime = entry.timestamp;
            }
        }
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hitRate: 0, // Would need hit/miss tracking for accurate calculation
            oldestEntry: oldestTime
        };
    }
    destroy() {
        clearInterval(this.cleanupInterval);
        this.clear();
    }
}
exports.MemoryCache = MemoryCache;
// Singleton instance
exports.globalCache = new MemoryCache();
//# sourceMappingURL=cache.js.map