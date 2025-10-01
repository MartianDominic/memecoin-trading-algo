/**
 * Cache Manager - Singleton cache management utility
 */

import { MemoryCache } from './cache';

export class CacheManager {
  private static instance: CacheManager;
  private readonly cache: MemoryCache;

  private constructor() {
    this.cache = new MemoryCache();
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, data, ttl);
  }

  get<T>(key: string): T | null {
    return this.cache.get<T>(key);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    return this.cache.getStats();
  }

  destroy(): void {
    this.cache.destroy();
  }
}