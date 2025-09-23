"use strict";
/**
 * API Services Index - Unified Export
 * Hive Mind Integration - Complete API Service Layer
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenAnalysisService = exports.TokenAnalysisService = exports.BlockchainService = exports.healthCheckService = exports.HealthCheckService = exports.TokenAggregatorService = exports.TokenPipelineService = exports.SolscanService = exports.JupiterService = exports.RugCheckService = exports.DexScreenerService = void 0;
// Core Services
var dexscreener_service_1 = require("./dexscreener.service");
Object.defineProperty(exports, "DexScreenerService", { enumerable: true, get: function () { return dexscreener_service_1.DexScreenerService; } });
var rugcheck_service_1 = require("./rugcheck.service");
Object.defineProperty(exports, "RugCheckService", { enumerable: true, get: function () { return rugcheck_service_1.RugCheckService; } });
var jupiter_service_1 = require("./jupiter.service");
Object.defineProperty(exports, "JupiterService", { enumerable: true, get: function () { return jupiter_service_1.JupiterService; } });
var solscan_service_1 = require("./solscan.service");
Object.defineProperty(exports, "SolscanService", { enumerable: true, get: function () { return solscan_service_1.SolscanService; } });
// Aggregation Services
var token_pipeline_service_1 = require("./token-pipeline.service");
Object.defineProperty(exports, "TokenPipelineService", { enumerable: true, get: function () { return token_pipeline_service_1.TokenPipelineService; } });
var token_aggregator_service_1 = require("./token-aggregator.service");
Object.defineProperty(exports, "TokenAggregatorService", { enumerable: true, get: function () { return token_aggregator_service_1.TokenAggregatorService; } });
// Health and Monitoring
var health_check_service_1 = require("./health-check.service");
Object.defineProperty(exports, "HealthCheckService", { enumerable: true, get: function () { return health_check_service_1.HealthCheckService; } });
Object.defineProperty(exports, "healthCheckService", { enumerable: true, get: function () { return health_check_service_1.healthCheckService; } });
// Blockchain Service (existing)
var blockchain_service_1 = require("./blockchain.service");
Object.defineProperty(exports, "BlockchainService", { enumerable: true, get: function () { return blockchain_service_1.BlockchainService; } });
// Combined Service Manager for Easy Integration
const dexscreener_service_2 = require("./dexscreener.service");
const rugcheck_service_2 = require("./rugcheck.service");
const jupiter_service_2 = require("./jupiter.service");
const solscan_service_2 = require("./solscan.service");
const health_check_service_2 = require("./health-check.service");
const logger_1 = require("../utils/logger");
class TokenAnalysisService {
    constructor() {
        this.logger = logger_1.Logger.getInstance();
        this.dexScreener = new dexscreener_service_2.DexScreenerService();
        this.rugCheck = new rugcheck_service_2.RugCheckService();
        this.jupiter = new jupiter_service_2.JupiterService();
        this.solscan = new solscan_service_2.SolscanService();
        this.logger.info('TokenAnalysisService initialized with all API services');
    }
    /**
     * Perform comprehensive token analysis using all services
     */
    async analyzeToken(tokenAddress, filters) {
        try {
            this.logger.info('Starting comprehensive token analysis', { tokenAddress });
            // Run all analyses in parallel for maximum speed
            const [dexScreenerResult, rugCheckResult, jupiterResult, solscanResult] = await Promise.allSettled([
                this.dexScreener.getTokenData(tokenAddress, filters),
                this.rugCheck.analyzeToken(tokenAddress, filters),
                this.jupiter.analyzeToken(tokenAddress, filters),
                this.solscan.analyzeToken(tokenAddress, filters)
            ]);
            // Extract data from results
            const dexData = dexScreenerResult.status === 'fulfilled' && dexScreenerResult.value.success
                ? dexScreenerResult.value.data?.[0]
                : null;
            const rugData = rugCheckResult.status === 'fulfilled' && rugCheckResult.value.success
                ? rugCheckResult.value.data
                : null;
            const jupiterData = jupiterResult.status === 'fulfilled' && jupiterResult.value.success
                ? jupiterResult.value.data
                : null;
            const solscanData = solscanResult.status === 'fulfilled' && solscanResult.value.success
                ? solscanResult.value.data
                : null;
            // Calculate overall score and determine pass/fail
            const analysis = this.buildCombinedAnalysis(tokenAddress, dexData, rugData, jupiterData, solscanData, filters);
            this.logger.info('Token analysis completed', {
                tokenAddress,
                overallScore: analysis.overallScore,
                passed: analysis.passed,
                failedFilters: analysis.failedFilters
            });
            return {
                success: true,
                data: analysis,
                timestamp: new Date(),
                source: 'combined-analysis'
            };
        }
        catch (error) {
            this.logger.error('Failed to perform comprehensive token analysis', {
                tokenAddress,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date(),
                source: 'combined-analysis'
            };
        }
    }
    buildCombinedAnalysis(tokenAddress, dexData, rugData, jupiterData, solscanData, filters) {
        const failedFilters = [];
        let totalScore = 0;
        let scoreComponents = 0;
        // DEXScreener scoring (25 points max)
        if (dexData && !dexData.filtered) {
            totalScore += 25;
            scoreComponents++;
        }
        else if (dexData?.filterReason) {
            failedFilters.push(`DEX: ${dexData.filterReason}`);
        }
        // RugCheck scoring (30 points max)
        if (rugData && !rugData.filtered) {
            const rugScore = (rugData.safetyScore / 10) * 30;
            totalScore += rugScore;
            scoreComponents++;
        }
        else if (rugData?.filterReason) {
            failedFilters.push(`Security: ${rugData.filterReason}`);
        }
        // Jupiter scoring (25 points max)
        if (jupiterData && !jupiterData.filtered) {
            let jupiterScore = 25;
            if (jupiterData.slippageEstimate > 10)
                jupiterScore -= 10;
            if (jupiterData.blacklisted)
                jupiterScore -= 15;
            totalScore += Math.max(0, jupiterScore);
            scoreComponents++;
        }
        else if (jupiterData?.filterReason) {
            failedFilters.push(`Routing: ${jupiterData.filterReason}`);
        }
        // Solscan scoring (20 points max)
        if (solscanData && !solscanData.filtered) {
            let solscanScore = 20;
            if (solscanData.creatorInfo.ruggedTokens > 0) {
                solscanScore -= solscanData.creatorInfo.ruggedTokens * 5;
            }
            if (solscanData.topHoldersPercentage > 50) {
                solscanScore -= 10;
            }
            totalScore += Math.max(0, solscanScore);
            scoreComponents++;
        }
        else if (solscanData?.filterReason) {
            failedFilters.push(`Creator: ${solscanData.filterReason}`);
        }
        // Normalize score to 0-100
        const overallScore = scoreComponents > 0 ? totalScore : 0;
        const passed = overallScore >= 60 && failedFilters.length === 0;
        return {
            address: tokenAddress.toLowerCase(),
            dexScreener: dexData || this.getDefaultDexData(tokenAddress),
            rugCheck: rugData || this.getDefaultRugData(tokenAddress),
            jupiter: jupiterData || this.getDefaultJupiterData(tokenAddress),
            solscan: solscanData || this.getDefaultSolscanData(tokenAddress),
            overallScore,
            passed,
            failedFilters,
            timestamp: new Date()
        };
    }
    getDefaultDexData(address) {
        return {
            address,
            symbol: 'UNKNOWN',
            name: 'Unknown Token',
            launchTimestamp: 0,
            price: 0,
            marketCap: 0,
            volume24h: 0,
            liquidity: 0,
            age: 0,
            filtered: true,
            filterReason: 'Data unavailable'
        };
    }
    getDefaultRugData(address) {
        return {
            address,
            honeypotRisk: true,
            mintAuthority: true,
            freezeAuthority: true,
            liquidityLocked: false,
            holderConcentration: 100,
            safetyScore: 0,
            risks: ['Data unavailable'],
            warnings: [],
            filtered: true,
            filterReason: 'Data unavailable'
        };
    }
    getDefaultJupiterData(address) {
        return {
            address,
            routingAvailable: false,
            slippageEstimate: 100,
            spread: 100,
            volume24h: 0,
            blacklisted: false,
            routeCount: 0,
            filtered: true,
            filterReason: 'Data unavailable'
        };
    }
    getDefaultSolscanData(address) {
        return {
            address,
            creatorWallet: 'unknown',
            creatorInfo: {
                address: 'unknown',
                createdTokens: 0,
                ruggedTokens: 0,
                successfulTokens: 0,
                successRate: 0,
                firstTokenDate: new Date(),
                averageHolding: 0
            },
            topHolders: [],
            topHoldersPercentage: 100,
            fundingPattern: 'suspicious',
            filtered: true,
            filterReason: 'Data unavailable'
        };
    }
    /**
     * Get health status of all services
     */
    async getSystemHealth() {
        return await health_check_service_2.healthCheckService.checkAllServices();
    }
    /**
     * Get performance statistics for all services
     */
    async getServiceStats() {
        return {
            dexScreener: this.dexScreener.getStats(),
            rugCheck: this.rugCheck.getStats(),
            jupiter: this.jupiter.getStats(),
            solscan: this.solscan.getStats(),
            system: await health_check_service_2.healthCheckService.getServiceStats()
        };
    }
}
exports.TokenAnalysisService = TokenAnalysisService;
// Export singleton instance
exports.tokenAnalysisService = new TokenAnalysisService();
//# sourceMappingURL=index.js.map