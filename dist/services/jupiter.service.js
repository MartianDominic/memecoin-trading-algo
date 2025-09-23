"use strict";
/**
 * Jupiter Aggregator Service
 * Hive Mind Integration - DEX Routing and Slippage Analysis
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JupiterService = void 0;
const axios_1 = __importDefault(require("axios"));
const rate_limiter_1 = require("../utils/rate-limiter");
const cache_1 = require("../utils/cache");
const logger_1 = require("../utils/logger");
class JupiterService {
    constructor() {
        this.logger = logger_1.Logger.getInstance();
        this.serviceName = 'jupiter';
        // Standard test amounts for slippage analysis
        this.testAmounts = [100, 500, 1000, 5000]; // USD values
        this.usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        this.solMint = 'So11111111111111111111111111111111111111112';
        // Known blacklisted tokens
        this.blacklistedTokens = new Set();
        this.client = axios_1.default.create({
            baseURL: 'https://quote-api.jup.ag/v6',
            timeout: 15000,
            headers: {
                'User-Agent': 'memecoin-trading-algo/1.0.0',
                'Accept': 'application/json'
            }
        });
        this.rateLimiter = new rate_limiter_1.RateLimiter(rate_limiter_1.DEFAULT_RATE_LIMITS);
        this.setupInterceptors();
        this.loadBlacklist();
    }
    setupInterceptors() {
        this.client.interceptors.request.use((config) => {
            this.logger.debug(`Jupiter API request: ${config.method?.toUpperCase()} ${config.url}`, {
                params: config.params
            });
            return config;
        }, (error) => {
            this.logger.error('Jupiter request error', { error });
            return Promise.reject(error);
        });
        this.client.interceptors.response.use((response) => {
            this.logger.debug(`Jupiter API response: ${response.status}`, {
                url: response.config.url
            });
            return response;
        }, (error) => {
            this.logger.error('Jupiter response error', {
                status: error.response?.status,
                message: error.message,
                url: error.config?.url
            });
            return Promise.reject(error);
        });
    }
    async loadBlacklist() {
        try {
            // Load Jupiter's token blacklist
            const response = await this.client.get('/tokens');
            const tokens = response.data;
            tokens.forEach(token => {
                if (token.tags.includes('blacklisted') || token.tags.includes('community-blacklisted')) {
                    this.blacklistedTokens.add(token.address.toLowerCase());
                }
            });
            this.logger.info(`Loaded ${this.blacklistedTokens.size} blacklisted tokens`);
        }
        catch (error) {
            this.logger.warn('Failed to load Jupiter blacklist', { error });
        }
    }
    async analyzeToken(tokenAddress, filters) {
        try {
            const cacheKey = `jupiter:analysis:${tokenAddress.toLowerCase()}`;
            // Check cache first
            const cached = cache_1.globalCache.get(cacheKey);
            if (cached) {
                this.logger.debug('Jupiter cache hit', { tokenAddress });
                return {
                    success: true,
                    data: cached,
                    timestamp: new Date(),
                    source: this.serviceName
                };
            }
            const result = await this.rateLimiter.executeWithBackoff(this.serviceName, async () => {
                // Perform multiple analyses in parallel
                const [routingAnalysis, slippageAnalysis, volumeAnalysis] = await Promise.allSettled([
                    this.checkRouting(tokenAddress),
                    this.analyzeSlippage(tokenAddress),
                    this.analyzeVolume(tokenAddress)
                ]);
                return {
                    routing: routingAnalysis.status === 'fulfilled' ? routingAnalysis.value : null,
                    slippage: slippageAnalysis.status === 'fulfilled' ? slippageAnalysis.value : null,
                    volume: volumeAnalysis.status === 'fulfilled' ? volumeAnalysis.value : null
                };
            }, rate_limiter_1.DEFAULT_RETRY_CONFIG);
            const analysis = this.buildTokenAnalysis(tokenAddress, result);
            // Apply filters
            if (filters) {
                const filterResult = this.applyRoutingFilters(analysis, filters);
                analysis.filtered = !filterResult.passed;
                analysis.filterReason = filterResult.reason;
            }
            // Cache for 2 minutes (routing can change frequently)
            cache_1.globalCache.set(cacheKey, analysis, 120);
            // Store in hive memory
            await this.storeInHiveMemory('routing-analysis', {
                address: tokenAddress,
                routingAvailable: analysis.routingAvailable,
                slippage: analysis.slippageEstimate
            });
            return {
                success: true,
                data: analysis,
                timestamp: new Date(),
                source: this.serviceName
            };
        }
        catch (error) {
            this.logger.error('Failed to analyze Jupiter routing', {
                tokenAddress,
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
    async checkRouting(tokenAddress) {
        try {
            // Test routing from USDC to target token
            const amount = 500 * 1000000; // $500 in USDC (6 decimals)
            const response = await this.client.get('/quote', {
                params: {
                    inputMint: this.usdcMint,
                    outputMint: tokenAddress,
                    amount: amount.toString(),
                    slippageBps: 300, // 3% slippage tolerance
                    onlyDirectRoutes: false,
                    asLegacyTransaction: false
                }
            });
            return {
                available: true,
                routeCount: response.data.routePlan?.length || 0,
                bestRoute: response.data
            };
        }
        catch (error) {
            // No routing available
            return {
                available: false,
                routeCount: 0
            };
        }
    }
    async analyzeSlippage(tokenAddress) {
        const estimates = [];
        for (const testAmount of this.testAmounts) {
            try {
                const amountInUsdc = testAmount * 1000000; // Convert to USDC units
                const response = await this.client.get('/quote', {
                    params: {
                        inputMint: this.usdcMint,
                        outputMint: tokenAddress,
                        amount: amountInUsdc.toString(),
                        slippageBps: 1000, // 10% max slippage for testing
                        onlyDirectRoutes: false
                    }
                });
                const priceImpact = parseFloat(response.data.priceImpactPct || '0');
                estimates.push({
                    amount: testAmount,
                    slippage: Math.abs(priceImpact)
                });
                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            catch (error) {
                // If we can't get a quote for this amount, record high slippage
                estimates.push({
                    amount: testAmount,
                    slippage: 50 // 50% as penalty for unavailable routing
                });
            }
        }
        const averageSlippage = estimates.reduce((sum, est) => sum + est.slippage, 0) / estimates.length;
        return { estimates, averageSlippage };
    }
    async analyzeVolume(tokenAddress) {
        try {
            // Get volume data by checking both directions of a trade
            const [buyQuote, sellQuote] = await Promise.allSettled([
                this.getQuote(this.usdcMint, tokenAddress, 1000 * 1000000), // Buy with $1000
                this.getQuote(tokenAddress, this.usdcMint, 1000000000) // Sell some tokens
            ]);
            // Calculate spread between buy and sell prices
            let spread = 0;
            if (buyQuote.status === 'fulfilled' && sellQuote.status === 'fulfilled') {
                const buyPrice = parseFloat(buyQuote.value.priceImpactPct || '0');
                const sellPrice = parseFloat(sellQuote.value.priceImpactPct || '0');
                spread = Math.abs(buyPrice - sellPrice);
            }
            // Volume estimation (simplified - would need more sophisticated analysis)
            const estimatedVolume = spread < 5 ? 100000 : spread < 10 ? 50000 : 10000;
            return {
                volume24h: estimatedVolume,
                spread
            };
        }
        catch (error) {
            return {
                volume24h: 0,
                spread: 100 // High spread indicates poor liquidity
            };
        }
    }
    async getQuote(inputMint, outputMint, amount) {
        const response = await this.client.get('/quote', {
            params: {
                inputMint,
                outputMint,
                amount: amount.toString(),
                slippageBps: 500 // 5% slippage
            }
        });
        return response.data;
    }
    buildTokenAnalysis(tokenAddress, data) {
        const blacklisted = this.blacklistedTokens.has(tokenAddress.toLowerCase());
        return {
            address: tokenAddress.toLowerCase(),
            routingAvailable: data.routing?.available || false,
            slippageEstimate: data.slippage?.averageSlippage || 100,
            spread: data.volume?.spread || 100,
            volume24h: data.volume?.volume24h || 0,
            blacklisted,
            routeCount: data.routing?.routeCount || 0,
            filtered: false
        };
    }
    applyRoutingFilters(analysis, filters) {
        // Routing requirement
        if (filters.requireRouting === true && !analysis.routingAvailable) {
            return { passed: false, reason: 'No routing available through Jupiter' };
        }
        // Slippage filter
        if (filters.maxSlippage !== undefined && analysis.slippageEstimate > filters.maxSlippage) {
            return {
                passed: false,
                reason: `Slippage too high: ${analysis.slippageEstimate.toFixed(2)}% > ${filters.maxSlippage}%`
            };
        }
        // Blacklist filter
        if (filters.allowBlacklisted === false && analysis.blacklisted) {
            return { passed: false, reason: 'Token is blacklisted on Jupiter' };
        }
        return { passed: true };
    }
    async getTokenList() {
        try {
            const cacheKey = 'jupiter:tokenlist';
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
                const response = await this.client.get('/tokens');
                return response.data;
            }, rate_limiter_1.DEFAULT_RETRY_CONFIG);
            // Cache token list for 1 hour
            cache_1.globalCache.set(cacheKey, result, 3600);
            return {
                success: true,
                data: result,
                timestamp: new Date(),
                source: this.serviceName
            };
        }
        catch (error) {
            this.logger.error('Failed to fetch Jupiter token list', {
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
    async healthCheck() {
        const startTime = Date.now();
        try {
            // Test with a simple USDC->SOL quote
            await this.getQuote(this.usdcMint, this.solMint, 1000000); // $1 worth
            const latency = Date.now() - startTime;
            return {
                service: this.serviceName,
                healthy: true,
                latency,
                errorRate: 0,
                lastCheck: new Date(),
                endpoint: 'https://quote-api.jup.ag/v6'
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
                endpoint: 'https://quote-api.jup.ag/v6'
            };
        }
    }
    async storeInHiveMemory(key, data) {
        try {
            cache_1.globalCache.set(`hive:jupiter:${key}`, data, 300);
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
            cacheHits: cacheStats.size,
            blacklistedTokens: this.blacklistedTokens.size
        };
    }
}
exports.JupiterService = JupiterService;
//# sourceMappingURL=jupiter.service.js.map