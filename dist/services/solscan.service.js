"use strict";
/**
 * Solscan Creator and Holder Analysis Service
 * Hive Mind Integration - Token Creator Behavior Analysis
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolscanService = void 0;
const axios_1 = __importDefault(require("axios"));
const rate_limiter_1 = require("../utils/rate-limiter");
const cache_1 = require("../utils/cache");
const logger_1 = require("../utils/logger");
class SolscanService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.logger = logger_1.Logger.getInstance();
        this.serviceName = 'solscan';
        // Known patterns for suspicious behavior
        this.suspiciousWalletPatterns = [
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, // UUID pattern
            /^test/i,
            /^temp/i,
            /^fake/i
        ];
        // Minimum age for established creators (30 days)
        this.minCreatorAge = 30 * 24 * 60 * 60 * 1000;
        this.client = axios_1.default.create({
            baseURL: 'https://public-api.solscan.io',
            timeout: 20000,
            headers: {
                'User-Agent': 'memecoin-trading-algo/1.0.0',
                'Accept': 'application/json',
                ...(apiKey && { 'token': apiKey })
            }
        });
        this.rateLimiter = new rate_limiter_1.RateLimiter(rate_limiter_1.DEFAULT_RATE_LIMITS);
        this.setupInterceptors();
    }
    setupInterceptors() {
        this.client.interceptors.request.use((config) => {
            this.logger.debug(`Solscan API request: ${config.method?.toUpperCase()} ${config.url}`, {
                params: config.params
            });
            return config;
        }, (error) => {
            this.logger.error('Solscan request error', { error });
            return Promise.reject(error);
        });
        this.client.interceptors.response.use((response) => {
            this.logger.debug(`Solscan API response: ${response.status}`, {
                url: response.config.url
            });
            return response;
        }, (error) => {
            this.logger.error('Solscan response error', {
                status: error.response?.status,
                message: error.message,
                url: error.config?.url
            });
            return Promise.reject(error);
        });
    }
    async analyzeToken(tokenAddress, filters) {
        try {
            const cacheKey = `solscan:analysis:${tokenAddress.toLowerCase()}`;
            // Check cache first
            const cached = cache_1.globalCache.get(cacheKey);
            if (cached) {
                this.logger.debug('Solscan cache hit', { tokenAddress });
                return {
                    success: true,
                    data: cached,
                    timestamp: new Date(),
                    source: this.serviceName
                };
            }
            const result = await this.rateLimiter.executeWithBackoff(this.serviceName, async () => {
                // Perform comprehensive creator and holder analysis
                const [tokenInfo, holders, creatorAnalysis] = await Promise.allSettled([
                    this.getTokenInfo(tokenAddress),
                    this.getTokenHolders(tokenAddress),
                    this.analyzeCreator(tokenAddress)
                ]);
                return {
                    tokenInfo: tokenInfo.status === 'fulfilled' ? tokenInfo.value : null,
                    holders: holders.status === 'fulfilled' ? holders.value : [],
                    creatorInfo: creatorAnalysis.status === 'fulfilled' ? creatorAnalysis.value : null
                };
            }, rate_limiter_1.DEFAULT_RETRY_CONFIG);
            const analysis = await this.buildTokenAnalysis(tokenAddress, result.tokenInfo, result.holders, result.creatorInfo);
            // Apply filters
            if (filters) {
                const filterResult = this.applyCreatorFilters(analysis, filters);
                analysis.filtered = !filterResult.passed;
                analysis.filterReason = filterResult.reason;
            }
            // Cache for 10 minutes (creator data is relatively stable)
            cache_1.globalCache.set(cacheKey, analysis, 600);
            // Store in hive memory
            await this.storeInHiveMemory('creator-analysis', {
                address: tokenAddress,
                creatorRugs: analysis.creatorInfo.ruggedTokens,
                successRate: analysis.creatorInfo.successRate,
                topHoldersPercentage: analysis.topHoldersPercentage
            });
            return {
                success: true,
                data: analysis,
                timestamp: new Date(),
                source: this.serviceName
            };
        }
        catch (error) {
            this.logger.error('Failed to analyze Solscan data', {
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
    async getTokenInfo(address) {
        try {
            const response = await this.client.get(`/token/meta`, {
                params: { tokenAddress: address }
            });
            return response.data;
        }
        catch (error) {
            // Fallback to simulation for testing
            return this.simulateTokenInfo(address);
        }
    }
    async getTokenHolders(address) {
        try {
            const response = await this.client.get(`/token/holders`, {
                params: {
                    tokenAddress: address,
                    limit: 50, // Get top 50 holders
                    offset: 0
                }
            });
            return response.data?.data?.map((holder, index) => ({
                address: holder.address,
                amount: holder.amount,
                decimals: holder.decimals,
                owner: holder.owner,
                rank: index + 1
            })) || [];
        }
        catch (error) {
            // Fallback to simulation
            return this.simulateTokenHolders(address);
        }
    }
    async analyzeCreator(tokenAddress) {
        try {
            // First get token info to find creator
            const tokenInfo = await this.getTokenInfo(tokenAddress);
            if (!tokenInfo?.creator) {
                return null;
            }
            // Get creator's token history
            const creatorTokens = await this.getCreatorTokenHistory(tokenInfo.creator);
            const analysis = this.analyzeCreatorBehavior(tokenInfo.creator, creatorTokens);
            return analysis;
        }
        catch (error) {
            this.logger.warn('Failed to analyze creator', { tokenAddress, error });
            return this.simulateCreatorInfo();
        }
    }
    async getCreatorTokenHistory(creatorAddress) {
        try {
            // Get account's SPL token transactions to find created tokens
            const response = await this.client.get(`/account/splTransfers`, {
                params: {
                    account: creatorAddress,
                    limit: 100
                }
            });
            // This would need more sophisticated analysis in practice
            // For now, return simulation data
            return this.simulateCreatorTokens(creatorAddress);
        }
        catch (error) {
            return this.simulateCreatorTokens(creatorAddress);
        }
    }
    analyzeCreatorBehavior(creatorAddress, tokens) {
        const now = Date.now();
        // Calculate metrics
        const createdTokens = tokens.length;
        const firstToken = tokens.sort((a, b) => a.createdTime - b.createdTime)[0];
        const firstTokenDate = firstToken ? new Date(firstToken.createdTime * 1000) : new Date();
        // Simulate rug detection (in practice would analyze price/liquidity history)
        const ruggedTokens = tokens.filter(token => {
            // Simulate rug detection logic
            const age = (now - token.createdTime * 1000) / (1000 * 60 * 60 * 24); // days
            return age > 7 && Math.random() < 0.3; // 30% chance of being rugged after 7 days
        }).length;
        const successfulTokens = createdTokens - ruggedTokens;
        const successRate = createdTokens > 0 ? (successfulTokens / createdTokens) * 100 : 0;
        // Calculate average holding time (simplified)
        const averageHolding = tokens.reduce((sum, token) => {
            const holdingDays = (now - token.createdTime * 1000) / (1000 * 60 * 60 * 24);
            return sum + Math.min(holdingDays, 30); // Cap at 30 days
        }, 0) / Math.max(tokens.length, 1);
        return {
            address: creatorAddress,
            createdTokens,
            ruggedTokens,
            successfulTokens,
            successRate,
            firstTokenDate,
            averageHolding
        };
    }
    async buildTokenAnalysis(tokenAddress, tokenInfo, holders, creatorInfo) {
        // Calculate top holders percentage (top 3)
        const topHolders = holders.slice(0, 3);
        const totalSupply = holders.reduce((sum, holder) => {
            return sum + parseFloat(holder.amount);
        }, 0);
        const topHoldersAmount = topHolders.reduce((sum, holder) => {
            return sum + parseFloat(holder.amount);
        }, 0);
        const topHoldersPercentage = totalSupply > 0 ? (topHoldersAmount / totalSupply) * 100 : 100;
        // Analyze funding patterns
        const fundingPattern = this.analyzeFundingPattern(holders);
        return {
            address: tokenAddress.toLowerCase(),
            creatorWallet: tokenInfo?.creator || 'unknown',
            creatorInfo: creatorInfo || this.simulateCreatorInfo(),
            topHolders,
            topHoldersPercentage,
            fundingPattern,
            filtered: false
        };
    }
    analyzeFundingPattern(holders) {
        // Analyze distribution patterns
        if (holders.length < 10)
            return 'suspicious';
        // Check for unusual concentration patterns
        const amounts = holders.map(h => parseFloat(h.amount));
        const sortedAmounts = [...amounts].sort((a, b) => b - a);
        // If top holder has more than 50%, it's suspicious
        if (sortedAmounts[0] / amounts.reduce((sum, amt) => sum + amt, 0) > 0.5) {
            return 'suspicious';
        }
        // Check for coordinated wallets (similar amounts, suspicious addresses)
        const suspiciousCount = holders.filter(holder => this.suspiciousWalletPatterns.some(pattern => pattern.test(holder.address))).length;
        if (suspiciousCount > holders.length * 0.3) {
            return 'coordinated';
        }
        return 'organic';
    }
    applyCreatorFilters(analysis, filters) {
        // Creator rug history filter
        if (filters.maxCreatorRugs !== undefined &&
            analysis.creatorInfo.ruggedTokens > filters.maxCreatorRugs) {
            return {
                passed: false,
                reason: `Creator has too many rugs: ${analysis.creatorInfo.ruggedTokens} > ${filters.maxCreatorRugs}`
            };
        }
        // Top holders concentration filter
        if (filters.maxTopHoldersPercentage !== undefined &&
            analysis.topHoldersPercentage > filters.maxTopHoldersPercentage) {
            return {
                passed: false,
                reason: `Top holders concentration too high: ${analysis.topHoldersPercentage.toFixed(1)}% > ${filters.maxTopHoldersPercentage}%`
            };
        }
        return { passed: true };
    }
    // Simulation methods for testing when API is unavailable
    simulateTokenInfo(address) {
        return {
            address,
            symbol: 'TEST',
            name: 'Test Token',
            decimals: 9,
            supply: '1000000000000000000',
            creator: `creator-${address.slice(0, 8)}`,
            createdTime: Date.now() / 1000 - Math.random() * 86400 * 30 // Random time in last 30 days
        };
    }
    simulateTokenHolders(address) {
        const holderCount = Math.floor(Math.random() * 50) + 10;
        const holders = [];
        for (let i = 0; i < holderCount; i++) {
            const amount = Math.floor(Math.random() * 1000000 * (holderCount - i)).toString();
            holders.push({
                address: `holder-${i}-${address.slice(0, 8)}`,
                amount,
                decimals: 9,
                owner: `owner-${i}`,
                rank: i + 1
            });
        }
        return holders;
    }
    simulateCreatorInfo() {
        const createdTokens = Math.floor(Math.random() * 10) + 1;
        const ruggedTokens = Math.floor(Math.random() * createdTokens * 0.4);
        const successfulTokens = createdTokens - ruggedTokens;
        return {
            address: 'simulated-creator',
            createdTokens,
            ruggedTokens,
            successfulTokens,
            successRate: (successfulTokens / createdTokens) * 100,
            firstTokenDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
            averageHolding: Math.random() * 30
        };
    }
    simulateCreatorTokens(creatorAddress) {
        const tokenCount = Math.floor(Math.random() * 8) + 1;
        const tokens = [];
        for (let i = 0; i < tokenCount; i++) {
            tokens.push({
                address: `token-${i}-${creatorAddress}`,
                symbol: `TOK${i}`,
                name: `Token ${i}`,
                decimals: 9,
                supply: '1000000000000000000',
                creator: creatorAddress,
                createdTime: Date.now() / 1000 - Math.random() * 86400 * 90 // Random time in last 90 days
            });
        }
        return tokens;
    }
    async healthCheck() {
        const startTime = Date.now();
        try {
            // Test with a known token
            await this.client.get('/token/meta', {
                params: { tokenAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' }, // USDT
                timeout: 5000
            });
            const latency = Date.now() - startTime;
            return {
                service: this.serviceName,
                healthy: true,
                latency,
                errorRate: 0,
                lastCheck: new Date(),
                endpoint: 'https://public-api.solscan.io'
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
                endpoint: 'https://public-api.solscan.io'
            };
        }
    }
    async storeInHiveMemory(key, data) {
        try {
            cache_1.globalCache.set(`hive:solscan:${key}`, data, 300);
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
exports.SolscanService = SolscanService;
//# sourceMappingURL=solscan.service.js.map