/**
 * Advanced Rate Limiter with Exponential Backoff
 * Hive Mind Integration - Rate Limiting Utility
 */
import { RateLimitConfig, RetryConfig } from '../types/api.types';
export declare class RateLimiter {
    private readonly configs;
    private readonly requestQueues;
    private readonly backoffQueues;
    private readonly logger;
    constructor(configs: Map<string, RateLimitConfig>);
    waitForSlot(service: string): Promise<void>;
    executeWithBackoff<T>(service: string, operation: () => Promise<T>, retryConfig: RetryConfig): Promise<T>;
    private calculateBackoffDelay;
    private sleep;
    getStats(service: string): {
        currentRequests: number;
        backoffDelay: number;
    };
    reset(service?: string): void;
}
export declare const DEFAULT_RATE_LIMITS: Map<string, RateLimitConfig>;
export declare const DEFAULT_RETRY_CONFIG: RetryConfig;
//# sourceMappingURL=rate-limiter.d.ts.map