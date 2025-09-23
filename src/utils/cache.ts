/**
 * High-Performance Memory Cache with TTL
 * Hive Mind Integration - Caching Utility
 */

import { CacheEntry } from '../types/api.types';
import { Logger } from './logger';

export class MemoryCache {
  private readonly cache: Map<string, CacheEntry<unknown>> = new Map();
  private readonly cleanupInterval: NodeJS.Timeout;
  private readonly logger = Logger.getInstance();

  constructor(
    private readonly defaultTtl: number = 300, // 5 minutes default
    private readonly maxSize: number = 10000,
    private readonly cleanupIntervalMs: number = 60000 // 1 minute
  ) {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);
  }

  set<T>(key: string, data: T, ttl?: number): void {
    // Ensure we don't exceed max size
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: new Date(),
      ttl: ttl || this.defaultTtl,
      key
    };

    this.cache.set(key, entry as CacheEntry<unknown>);

    this.logger.debug(`Cache set: ${key}`, {
      key,
      ttl: entry.ttl,
      cacheSize: this.cache.size
    });
  }

  get<T>(key: string): T | null {
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
    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    const age = now - entry.timestamp.getTime();

    if (age > entry.ttl * 1000) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.logger.debug(`Cache deleted: ${key}`);
    }
    return deleted;
  }

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.info(`Cache cleared, removed ${size} entries`);
  }

  private cleanup(): void {
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

  private evictOldest(): void {
    let oldestKey: string | null = null;
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

  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    oldestEntry: Date | null;
  } {
    let oldestTime: Date | null = null;

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

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.clear();
  }
}

// Singleton instance
export const globalCache = new MemoryCache();