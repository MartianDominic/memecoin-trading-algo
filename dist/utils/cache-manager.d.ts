/**
 * Cache Manager - Singleton cache management utility
 */
export declare class CacheManager {
    private static instance;
    private readonly cache;
    private constructor();
    static getInstance(): CacheManager;
    set<T>(key: string, data: T, ttl?: number): void;
    get<T>(key: string): T | null;
    has(key: string): boolean;
    delete(key: string): boolean;
    clear(): void;
    getStats(): {
        size: number;
        maxSize: number;
        hitRate: number;
        oldestEntry: Date | null;
    };
    destroy(): void;
}
//# sourceMappingURL=cache-manager.d.ts.map