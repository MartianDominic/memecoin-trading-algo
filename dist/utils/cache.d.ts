/**
 * High-Performance Memory Cache with TTL
 * Hive Mind Integration - Caching Utility
 */
export declare class MemoryCache {
    private readonly defaultTtl;
    private readonly maxSize;
    private readonly cleanupIntervalMs;
    private readonly cache;
    private readonly cleanupInterval;
    private readonly logger;
    constructor(defaultTtl?: number, // 5 minutes default
    maxSize?: number, cleanupIntervalMs?: number);
    set<T>(key: string, data: T, ttl?: number): void;
    get<T>(key: string): T | null;
    has(key: string): boolean;
    delete(key: string): boolean;
    clear(): void;
    private cleanup;
    private evictOldest;
    getStats(): {
        size: number;
        maxSize: number;
        hitRate: number;
        oldestEntry: Date | null;
    };
    destroy(): void;
}
export declare const globalCache: MemoryCache;
//# sourceMappingURL=cache.d.ts.map