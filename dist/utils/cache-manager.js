"use strict";
/**
 * Cache Manager - Singleton cache management utility
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheManager = void 0;
const cache_1 = require("./cache");
class CacheManager {
    constructor() {
        this.cache = new cache_1.MemoryCache();
    }
    static getInstance() {
        if (!CacheManager.instance) {
            CacheManager.instance = new CacheManager();
        }
        return CacheManager.instance;
    }
    set(key, data, ttl) {
        this.cache.set(key, data, ttl);
    }
    get(key) {
        return this.cache.get(key);
    }
    has(key) {
        return this.cache.has(key);
    }
    delete(key) {
        return this.cache.delete(key);
    }
    clear() {
        this.cache.clear();
    }
    getStats() {
        return this.cache.getStats();
    }
    destroy() {
        this.cache.destroy();
    }
}
exports.CacheManager = CacheManager;
//# sourceMappingURL=cache-manager.js.map