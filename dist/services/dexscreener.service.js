"use strict";
/**
 * DEXScreener API Service
 * Hive Mind Integration - Token Launch and Metrics Detection
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DexScreenerService = void 0;
const axios_1 = __importDefault(require("axios"));
const rate_limiter_1 = require("../utils/rate-limiter");
const cache_1 = require("../utils/cache");
const logger_1 = require("../utils/logger");
class DexScreenerService {
    constructor() {
        this.logger = logger_1.Logger.getInstance();
        this.serviceName = 'dexscreener';
        this.client = axios_1.default.create({
            baseURL: 'https://api.dexscreener.com/latest/dex',
            timeout: 15000,
            headers: {
                'User-Agent': 'memecoin-trading-algo/1.0.0',
                'Accept': 'application/json'
            }
        });
        this.rateLimiter = new rate_limiter_1.RateLimiter(rate_limiter_1.DEFAULT_RATE_LIMITS);
        this.setupInterceptors();
    }
    setupInterceptors() {
        this.client.interceptors.request.use((config) => {
            this.logger.debug(`DEXScreener API request: ${config.method?.toUpperCase()} ${config.url}`, {
                params: config.params
            });
            return config;
        }, (error) => {
            this.logger.error('DEXScreener request error', { error });
            return Promise.reject(error);
        });
        this.client.interceptors.response.use((response) => {
            this.logger.debug(`DEXScreener API response: ${response.status}`, {
                url: response.config.url,
                dataLength: response.data?.pairs?.length || 0
            });
            return response;
        }, (error) => {
            this.logger.error('DEXScreener response error', {
                status: error.response?.status,
                message: error.message,
                url: error.config?.url
            });
            return Promise.reject(error);
        });
    }
    async getTokenData(tokenAddresses, filters) {
        try {
            const addresses = Array.isArray(tokenAddresses) ? tokenAddresses : [tokenAddresses];
            const cacheKey = `dexscreener:tokens:${addresses.join(',')}`;
            // Check cache first
            const cached = cache_1.globalCache.get(cacheKey);
            if (cached) {
                this.logger.debug('DEXScreener cache hit', { addresses, count: cached.length });
                return {
                    success: true,
                    data: cached,
                    timestamp: new Date(),
                    source: this.serviceName
                };
            }
            const result = await this.rateLimiter.executeWithBackoff(this.serviceName, async () => {
                const response = await this.client.get(`/tokens/${addresses.join(',')}`);
                return response.data;
            }, rate_limiter_1.DEFAULT_RETRY_CONFIG);
            const tokenData = this.processTokenData(result.pairs || [], filters);
            // Cache the results
            cache_1.globalCache.set(cacheKey, tokenData, 60); // Cache for 1 minute
            // Store in hive memory
            await this.storeInHiveMemory('token-data', { addresses, count: tokenData.length });
            return {
                success: true,
                data: tokenData,
                timestamp: new Date(),
                source: this.serviceName
            };
        }
        catch (error) {
            this.logger.error('Failed to fetch DEXScreener token data', {
                addresses: tokenAddresses,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date(),
                source: this.serviceName
            };
        }
    }
    async getNewTokens(chain = 'solana', filters) {
        try {
            const cacheKey = `dexscreener:new:${chain}`;
            const cached = cache_1.globalCache.get(cacheKey);
            if (cached) {
                return {
                    success: true,
                    data: cached,
                    timestamp: new Date(),
                    source: this.serviceName
                };
            }
            const result = await this.rateLimiter.executeWithBackoff(this.serviceName, async () => {
                const response = await this.client.get('/tokens/trending');
                return response.data;
            }, rate_limiter_1.DEFAULT_RETRY_CONFIG);
            const chainPairs = result.pairs?.filter(pair => pair.chainId.toLowerCase() === chain.toLowerCase()) || [];
            const tokenData = this.processTokenData(chainPairs, filters);
            // Cache for 30 seconds (new tokens change frequently)
            cache_1.globalCache.set(cacheKey, tokenData, 30);
            return {
                success: true,
                data: tokenData,
                timestamp: new Date(),
                source: this.serviceName
            };
        }
        catch (error) {
            this.logger.error('Failed to fetch new tokens', {
                chain,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date(),
                source: this.serviceName
            };
        }
    }
    processTokenData(pairs, filters) {
        const now = Date.now();
        return pairs.map(pair => {
            const ageHours = (now - (pair.pairCreatedAt * 1000)) / (1000 * 60 * 60);
            const tokenData = {
                address: pair.baseToken.address.toLowerCase(),
                symbol: pair.baseToken.symbol,
                name: pair.baseToken.name,
                launchTimestamp: pair.pairCreatedAt,
                price: parseFloat(pair.priceUsd || '0'),
                marketCap: this.calculateMarketCap(pair),
                volume24h: pair.volume?.h24 || 0,
                liquidity: pair.liquidity?.usd || 0,
                age: ageHours,
                filtered: false
            };
            // Apply filters
            if (filters) {
                const filterResult = this.applyFilters(tokenData, filters);
                tokenData.filtered = !filterResult.passed;
                tokenData.filterReason = filterResult.reason;
            }
            return tokenData;
        });
    }
    calculateMarketCap(pair) {
        // Simplified market cap calculation
        // In practice, would need total supply data
        const price = parseFloat(pair.priceUsd || '0');
        const liquidity = pair.liquidity?.usd || 0;
        // Rough estimate: market cap ~ 10x liquidity for new tokens
        return price > 0 ? liquidity * 10 : 0;
    }
    applyFilters(token, filters) {
        // Age filters
        if (filters.minAge !== undefined && token.age < filters.minAge) {
            return { passed: false, reason: `Token too young: ${token.age.toFixed(1)}h < ${filters.minAge}h` };
        }
        if (filters.maxAge !== undefined && token.age > filters.maxAge) {
            return { passed: false, reason: `Token too old: ${token.age.toFixed(1)}h > ${filters.maxAge}h` };
        }
        // Liquidity filters
        if (filters.minLiquidity !== undefined && token.liquidity < filters.minLiquidity) {
            return { passed: false, reason: `Insufficient liquidity: $${token.liquidity} < $${filters.minLiquidity}` };
        }
        // Volume filters
        if (filters.minVolume !== undefined && token.volume24h < filters.minVolume) {
            return { passed: false, reason: `Insufficient volume: $${token.volume24h} < $${filters.minVolume}` };
        }
        return { passed: true };
    }
    async healthCheck() {
        const startTime = Date.now();
        try {
            await this.rateLimiter.executeWithBackoff(this.serviceName, async () => {
                const response = await this.client.get('/tokens/trending', {
                    timeout: 5000
                });
                return response.data;
            }, { ...rate_limiter_1.DEFAULT_RETRY_CONFIG, maxRetries: 1 });
            const latency = Date.now() - startTime;
            return {
                service: this.serviceName,
                healthy: true,
                latency,
                errorRate: 0,
                lastCheck: new Date(),
                endpoint: 'https://api.dexscreener.com/latest/dex'
            };
        }
        catch (error) {
            const latency = Date.now() - startTime;
            return {
                service: this.serviceName,
                healthy: false,
                latency,
                errorRate: 100,
                lastCheck: new Date(),
                endpoint: 'https://api.dexscreener.com/latest/dex'
            };
        }
    }
    async storeInHiveMemory(key, data) {
        try {
            // This would integrate with the hive mind memory system
            cache_1.globalCache.set(`hive:dexscreener:${key}`, data, 300);
        }
        catch (error) {
            this.logger.warn('Failed to store in hive memory', { key, error });
        }
    }
    getStats() {
        const rateLimitStats = this.rateLimiter.getStats(this.serviceName);
        const cacheStats = cache_1.globalCache.getStats();
        return {
            requests: rateLimitStats.currentRequests,
            backoff: rateLimitStats.backoffDelay,
            cacheHits: cacheStats.size
        };
    }
}
exports.DexScreenerService = DexScreenerService;
//# sourceMappingURL=dexscreener.service.js.map