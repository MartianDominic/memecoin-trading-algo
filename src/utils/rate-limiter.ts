/**
 * Advanced Rate Limiter with Exponential Backoff
 * Hive Mind Integration - Rate Limiting Utility
 */

import { RateLimitConfig, RetryConfig } from '../types/api.types';
import { Logger } from './logger';

export class RateLimiter {
  private readonly requestQueues: Map<string, number[]> = new Map();
  private readonly backoffQueues: Map<string, number> = new Map();
  private readonly logger = Logger.getInstance();

  constructor(
    private readonly configs: Map<string, RateLimitConfig>
  ) {}

  async waitForSlot(service: string): Promise<void> {
    const config = this.configs.get(service);
    if (!config) {
      throw new Error(`No rate limit configuration found for service: ${service}`);
    }

    const now = Date.now();
    const queue = this.requestQueues.get(service) || [];

    // Remove expired timestamps
    const validRequests = queue.filter(timestamp =>
      now - timestamp < config.windowMs
    );

    if (validRequests.length >= config.maxRequests) {
      const oldestRequest = Math.min(...validRequests);
      const waitTime = config.windowMs - (now - oldestRequest);

      this.logger.debug(`Rate limit reached for ${service}, waiting ${waitTime}ms`, {
        service,
        currentRequests: validRequests.length,
        maxRequests: config.maxRequests
      });

      await this.sleep(waitTime);
      return this.waitForSlot(service); // Recursive check
    }

    // Add current request timestamp
    validRequests.push(now);
    this.requestQueues.set(service, validRequests);
  }

  async executeWithBackoff<T>(
    service: string,
    operation: () => Promise<T>,
    retryConfig: RetryConfig
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        await this.waitForSlot(service);
        const result = await operation();

        // Reset backoff on success
        this.backoffQueues.delete(service);

        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt === retryConfig.maxRetries) {
          break;
        }

        const delay = this.calculateBackoffDelay(
          service,
          attempt,
          retryConfig
        );

        this.logger.warn(`Attempt ${attempt + 1} failed for ${service}, retrying in ${delay}ms`, {
          service,
          attempt: attempt + 1,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        await this.sleep(delay);
      }
    }

    throw new Error(`Operation failed after ${retryConfig.maxRetries + 1} attempts: ${lastError?.message}`);
  }

  private calculateBackoffDelay(
    service: string,
    attempt: number,
    config: RetryConfig
  ): number {
    const baseDelay = config.baseDelay * Math.pow(config.backoffFactor, attempt);
    const jitter = Math.random() * 0.1 * baseDelay; // Add 10% jitter
    const delay = Math.min(baseDelay + jitter, config.maxDelay);

    this.backoffQueues.set(service, delay);
    return delay;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats(service: string): { currentRequests: number; backoffDelay: number } {
    const queue = this.requestQueues.get(service) || [];
    const config = this.configs.get(service);
    const now = Date.now();

    const currentRequests = config
      ? queue.filter(timestamp => now - timestamp < config.windowMs).length
      : 0;

    const backoffDelay = this.backoffQueues.get(service) || 0;

    return { currentRequests, backoffDelay };
  }

  reset(service?: string): void {
    if (service) {
      this.requestQueues.delete(service);
      this.backoffQueues.delete(service);
    } else {
      this.requestQueues.clear();
      this.backoffQueues.clear();
    }
  }
}

// Default configurations for each service
export const DEFAULT_RATE_LIMITS: Map<string, RateLimitConfig> = new Map([
  ['dexscreener', {
    maxRequests: 300,
    windowMs: 60000, // 1 minute
    backoffMs: 1000,
    maxRetries: 3
  }],
  ['rugcheck', {
    maxRequests: 100,
    windowMs: 60000, // 1 minute
    backoffMs: 2000,
    maxRetries: 5
  }],
  ['jupiter', {
    maxRequests: 600,
    windowMs: 60000, // 1 minute
    backoffMs: 500,
    maxRetries: 3
  }],
  ['solscan', {
    maxRequests: 200,
    windowMs: 60000, // 1 minute
    backoffMs: 1500,
    maxRetries: 4
  }]
]);

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2
};