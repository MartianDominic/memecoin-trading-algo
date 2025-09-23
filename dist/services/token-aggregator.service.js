"use strict";
/**
 * Token Aggregator Service
 * Hive Mind Integration - Main Orchestrator for Token Detection Pipeline
 *
 * Coordinates all API services every 5 minutes:
 * - Discovers new tokens via DEXScreener
 * - Processes through TokenPipelineService
 * - Applies comprehensive filter pipeline
 * - Stores results in database
 * - Emits real-time events for frontend
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenAggregatorService = void 0;
const events_1 = require("events");
const cron = __importStar(require("node-cron"));
const token_pipeline_service_1 = require("./token-pipeline.service");
const health_check_service_1 = require("./health-check.service");
const logger_1 = require("../utils/logger");
const cache_1 = require("../utils/cache");
class TokenAggregatorService extends events_1.EventEmitter {
    constructor(dexScreenerService, rugCheckService, jupiterService, solscanService, config = {
        cronSchedule: '*/5 * * * *', // Every 5 minutes
        maxTokensPerRun: 100,
        enableRealTimeEvents: true,
        enableDatabaseStorage: true,
        enableAutoScaling: true,
        filters: {},
        pipeline: {
            batchSize: 20,
            maxConcurrent: 10,
            timeoutMs: 90000, // 1.5 minutes per token
            retryAttempts: 2,
            cacheResults: true
        }
    }) {
        super();
        this.dexScreenerService = dexScreenerService;
        this.rugCheckService = rugCheckService;
        this.jupiterService = jupiterService;
        this.solscanService = solscanService;
        this.config = config;
        this.logger = logger_1.Logger.getInstance();
        this.cronJob = null;
        this.stats = {
            totalRuns: 0,
            tokensDiscovered: 0,
            tokensProcessed: 0,
            tokensPassed: 0,
            tokensStored: 0,
            lastRunAt: new Date(0),
            nextRunAt: new Date(),
            averageRunTime: 0,
            isRunning: false,
            errorCount: 0,
            successRate: 0
        };
        this.runHistory = [];
        this.maxRunHistory = 100;
        this.runTimes = [];
        this.maxRunTimeHistory = 50;
        // Comprehensive filter criteria matching requirements
        this.defaultFilters = {
            // Age filters: < 24 hours
            maxAge: 24,
            minAge: 0.5, // At least 30 minutes old to avoid immediate launches
            // Liquidity filters: > $5k
            minLiquidity: 5000,
            // Volume filters: > $1k
            minVolume: 1000,
            // Security filters: Safety score ≥ 6, No honeypot
            minSafetyScore: 6,
            allowHoneypot: false,
            // Jupiter filters: Routing exists, < 10% slippage on $500
            requireRouting: true,
            maxSlippage: 10,
            allowBlacklisted: false,
            // Creator filters: < 3 rugs, Top 3 holders < 60%
            maxCreatorRugs: 2,
            maxTopHoldersPercentage: 60
        };
        this.processedTokens = new Set();
        this.blacklistedTokens = new Set();
        // Merge default filters with config
        this.config.filters = { ...this.defaultFilters, ...this.config.filters };
        // Initialize services
        this.tokenPipeline = new token_pipeline_service_1.TokenPipelineService(this.dexScreenerService, this.rugCheckService, this.jupiterService, this.solscanService, this.config.pipeline);
        this.healthCheck = new health_check_service_1.HealthCheckService([
            this.dexScreenerService,
            this.rugCheckService,
            this.jupiterService,
            this.solscanService
        ]);
        this.setupEventListeners();
        this.loadProcessedTokens();
    }
    setupEventListeners() {
        // Pipeline events
        this.tokenPipeline.on('token:complete', (analysis) => {
            this.handleTokenAnalysisComplete(analysis);
        });
        this.tokenPipeline.on('pipeline:error', (error, context) => {
            this.logger.error('Pipeline error in aggregator', { error: error.message, ...context });
            this.stats.errorCount++;
        });
        // Aggregator events
        this.on('run:start', (runId) => {
            this.logger.info(`Aggregation run started: ${runId}`);
            this.stats.isRunning = true;
        });
        this.on('run:complete', (run) => {
            this.logger.info(`Aggregation run completed: ${run.id}`, {
                tokensProcessed: run.tokensProcessed,
                tokensPassed: run.tokensPassed,
                duration: run.endTime ? run.endTime.getTime() - run.startTime.getTime() : 0
            });
            this.stats.isRunning = false;
            this.updateRunStats(run);
        });
        this.on('token:discovered', (tokens) => {
            this.logger.debug(`Discovered ${tokens.length} new tokens`);
        });
        this.on('token:passed', (analysis) => {
            this.logger.info(`Token passed all filters: ${analysis.address}`, {
                address: analysis.address,
                score: analysis.overallScore,
                liquidity: analysis.dexScreener.liquidity,
                volume: analysis.dexScreener.volume24h,
                safetyScore: analysis.rugCheck.safetyScore
            });
        });
        this.on('token:stored', (analysis) => {
            this.logger.debug(`Token stored in database: ${analysis.address}`);
            this.stats.tokensStored++;
        });
    }
    /**
     * Start the aggregation service with cron scheduling
     */
    start() {
        if (this.cronJob) {
            this.logger.warn('Aggregation service is already running');
            return;
        }
        this.logger.info(`Starting token aggregation service with schedule: ${this.config.cronSchedule}`);
        this.cronJob = cron.schedule(this.config.cronSchedule, async () => {
            await this.runAggregation();
        }, {
            scheduled: false
        });
        this.cronJob.start();
        // Calculate next run time
        this.updateNextRunTime();
        this.logger.info('Token aggregation service started successfully');
        // Emit startup event
        this.emit('service:started', {
            schedule: this.config.cronSchedule,
            nextRun: this.stats.nextRunAt
        });
    }
    /**
     * Stop the aggregation service
     */
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            this.logger.info('Token aggregation service stopped');
            this.emit('service:stopped', {
                totalRuns: this.stats.totalRuns,
                tokensProcessed: this.stats.tokensProcessed
            });
        }
    }
    /**
     * Run a single aggregation cycle
     */
    async runAggregation() {
        const runId = `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const startTime = Date.now();
        const run = {
            id: runId,
            startTime: new Date(),
            tokensDiscovered: 0,
            tokensProcessed: 0,
            tokensPassed: 0,
            errors: [],
            status: 'running'
        };
        this.emit('run:start', runId);
        try {
            // Check service health before proceeding
            await this.verifyServiceHealth();
            // Phase 1: Token Discovery
            this.logger.info('Phase 1: Token Discovery');
            const discoveryResult = await this.discoverNewTokens();
            run.tokensDiscovered = discoveryResult.newTokens.length;
            this.emit('token:discovered', discoveryResult.newTokens);
            if (discoveryResult.newTokens.length === 0) {
                this.logger.info('No new tokens discovered, ending run');
                run.status = 'completed';
                run.endTime = new Date();
                this.emit('run:complete', run);
                return run;
            }
            // Phase 2: Token Processing
            this.logger.info(`Phase 2: Processing ${discoveryResult.newTokens.length} tokens`);
            const analysisResults = await this.tokenPipeline.processBatch(discoveryResult.newTokens, this.config.filters);
            run.tokensProcessed = analysisResults.length;
            // Phase 3: Filter and Store Results
            this.logger.info('Phase 3: Filtering and Storage');
            const passedTokens = analysisResults.filter(analysis => analysis.passed);
            run.tokensPassed = passedTokens.length;
            // Store passed tokens
            if (this.config.enableDatabaseStorage) {
                await this.storeTokenAnalyses(passedTokens);
            }
            // Emit real-time events
            if (this.config.enableRealTimeEvents) {
                for (const analysis of passedTokens) {
                    this.emit('token:passed', analysis);
                }
            }
            // Update processed tokens cache
            this.updateProcessedTokensCache(discoveryResult.newTokens);
            // Mark run as completed
            run.status = 'completed';
            run.endTime = new Date();
            this.stats.totalRuns++;
            this.stats.lastRunAt = new Date();
            this.updateNextRunTime();
            this.emit('run:complete', run);
            return run;
        }
        catch (error) {
            run.status = 'failed';
            run.endTime = new Date();
            run.errors.push(error instanceof Error ? error.message : 'Unknown error');
            this.logger.error('Aggregation run failed', {
                runId,
                error: error instanceof Error ? error.message : 'Unknown error',
                duration: Date.now() - startTime
            });
            this.stats.errorCount++;
            this.emit('run:complete', run);
            return run;
        }
        finally {
            // Add run to history
            this.runHistory.unshift(run);
            if (this.runHistory.length > this.maxRunHistory) {
                this.runHistory.pop();
            }
            // Record run time
            const runTime = Date.now() - startTime;
            this.recordRunTime(runTime);
        }
    }
    /**
     * Discover new tokens from DEXScreener
     */
    async discoverNewTokens() {
        const startTime = Date.now();
        try {
            // Get trending tokens from Solana
            const response = await this.dexScreenerService.getNewTokens('solana', this.config.filters);
            if (!response.success || !response.data) {
                throw new Error(`Token discovery failed: ${response.error}`);
            }
            const allTokens = response.data;
            const newTokens = [];
            let alreadyProcessed = 0;
            // Filter out already processed and blacklisted tokens
            for (const tokenData of allTokens) {
                const address = tokenData.address.toLowerCase();
                if (this.processedTokens.has(address) || this.blacklistedTokens.has(address)) {
                    alreadyProcessed++;
                    continue;
                }
                newTokens.push(address);
                // Limit per run
                if (newTokens.length >= this.config.maxTokensPerRun) {
                    break;
                }
            }
            const discoveryTime = Date.now() - startTime;
            this.stats.tokensDiscovered += newTokens.length;
            return {
                newTokens,
                totalDiscovered: allTokens.length,
                alreadyProcessed,
                discoveryTime
            };
        }
        catch (error) {
            this.logger.error('Token discovery failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return {
                newTokens: [],
                totalDiscovered: 0,
                alreadyProcessed: 0,
                discoveryTime: Date.now() - startTime
            };
        }
    }
    /**
     * Verify that all services are healthy before processing
     */
    async verifyServiceHealth() {
        const healthChecks = await this.healthCheck.checkAllServices();
        const unhealthyServices = healthChecks.filter(check => !check.healthy);
        if (unhealthyServices.length > 0) {
            const serviceNames = unhealthyServices.map(s => s.service).join(', ');
            throw new Error(`Unhealthy services detected: ${serviceNames}`);
        }
        this.logger.debug('All services are healthy');
    }
    /**
     * Handle completed token analysis
     */
    handleTokenAnalysisComplete(analysis) {
        this.stats.tokensProcessed++;
        if (analysis.passed) {
            this.stats.tokensPassed++;
            this.emit('token:passed', analysis);
        }
        else {
            this.logger.debug(`Token filtered: ${analysis.address}`, {
                address: analysis.address,
                score: analysis.overallScore,
                failedFilters: analysis.failedFilters
            });
        }
        // Update success rate
        this.stats.successRate = (this.stats.tokensPassed / this.stats.tokensProcessed) * 100;
    }
    /**
     * Store token analyses in database (placeholder)
     */
    async storeTokenAnalyses(analyses) {
        try {
            // TODO: Implement actual database storage
            // This would integrate with Prisma/database layer
            for (const analysis of analyses) {
                // Simulate database storage
                await new Promise(resolve => setTimeout(resolve, 10));
                this.emit('token:stored', analysis);
            }
            this.logger.info(`Stored ${analyses.length} token analyses in database`);
        }
        catch (error) {
            this.logger.error('Failed to store token analyses', {
                error: error instanceof Error ? error.message : 'Unknown error',
                count: analyses.length
            });
            throw error;
        }
    }
    /**
     * Update processed tokens cache
     */
    updateProcessedTokensCache(tokenAddresses) {
        for (const address of tokenAddresses) {
            this.processedTokens.add(address.toLowerCase());
        }
        // Store in persistent cache
        cache_1.globalCache.set('aggregator:processed-tokens', Array.from(this.processedTokens), 86400); // 24 hours
    }
    /**
     * Load previously processed tokens from cache
     */
    loadProcessedTokens() {
        const cached = cache_1.globalCache.get('aggregator:processed-tokens');
        if (cached) {
            cached.forEach(address => this.processedTokens.add(address));
            this.logger.info(`Loaded ${cached.length} previously processed tokens`);
        }
    }
    /**
     * Update next run time based on cron schedule
     */
    updateNextRunTime() {
        // This is a simplified calculation - in practice would parse cron expression
        const now = new Date();
        this.stats.nextRunAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now
    }
    /**
     * Update aggregation run statistics
     */
    updateRunStats(run) {
        if (run.endTime && run.status === 'completed') {
            const runTime = run.endTime.getTime() - run.startTime.getTime();
            this.recordRunTime(runTime);
        }
        // Update success rate
        const completedRuns = this.runHistory.filter(r => r.status === 'completed').length;
        this.stats.successRate = this.stats.totalRuns > 0 ? (completedRuns / this.stats.totalRuns) * 100 : 0;
    }
    /**
     * Record run time for averaging
     */
    recordRunTime(time) {
        this.runTimes.unshift(time);
        if (this.runTimes.length > this.maxRunTimeHistory) {
            this.runTimes.pop();
        }
        // Update average
        this.stats.averageRunTime = this.runTimes.reduce((sum, t) => sum + t, 0) / this.runTimes.length;
    }
    /**
     * Add token to blacklist
     */
    addToBlacklist(tokenAddress, reason) {
        const address = tokenAddress.toLowerCase();
        this.blacklistedTokens.add(address);
        this.logger.info(`Token blacklisted: ${address}`, { reason });
        // Store in cache
        cache_1.globalCache.set('aggregator:blacklisted-tokens', Array.from(this.blacklistedTokens), 86400);
        this.emit('token:blacklisted', { address, reason });
    }
    /**
     * Remove token from blacklist
     */
    removeFromBlacklist(tokenAddress) {
        const address = tokenAddress.toLowerCase();
        const removed = this.blacklistedTokens.delete(address);
        if (removed) {
            this.logger.info(`Token removed from blacklist: ${address}`);
            // Update cache
            cache_1.globalCache.set('aggregator:blacklisted-tokens', Array.from(this.blacklistedTokens), 86400);
            this.emit('token:unblacklisted', { address });
        }
        return removed;
    }
    /**
     * Run manual aggregation (outside of cron schedule)
     */
    async runManualAggregation() {
        this.logger.info('Starting manual aggregation run');
        return await this.runAggregation();
    }
    /**
     * Get aggregation service statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Get recent run history
     */
    getRunHistory(limit = 10) {
        return this.runHistory.slice(0, limit);
    }
    /**
     * Get service configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Update service configuration
     */
    updateConfig(updates) {
        const oldSchedule = this.config.cronSchedule;
        Object.assign(this.config, updates);
        // Restart cron job if schedule changed
        if (updates.cronSchedule && updates.cronSchedule !== oldSchedule) {
            const wasRunning = this.cronJob !== null;
            this.stop();
            if (wasRunning) {
                this.start();
            }
        }
        // Update pipeline config if provided
        if (updates.pipeline) {
            this.tokenPipeline.updateConfig(updates.pipeline);
        }
        this.logger.info('Aggregator configuration updated', updates);
        this.emit('config:updated', updates);
    }
    /**
     * Get service health status
     */
    async getHealthStatus() {
        const services = await this.healthCheck.checkAllServices();
        const unhealthyServices = services.filter(s => !s.healthy);
        return {
            aggregator: {
                healthy: unhealthyServices.length === 0 && !this.stats.isRunning,
                message: unhealthyServices.length > 0
                    ? `${unhealthyServices.length} services unhealthy`
                    : this.stats.isRunning
                        ? 'Running aggregation'
                        : 'All systems operational'
            },
            services
        };
    }
    /**
     * Reset all statistics and caches
     */
    resetStats() {
        // Reset stats
        this.stats.totalRuns = 0;
        this.stats.tokensDiscovered = 0;
        this.stats.tokensProcessed = 0;
        this.stats.tokensPassed = 0;
        this.stats.tokensStored = 0;
        this.stats.lastRunAt = new Date(0);
        this.stats.averageRunTime = 0;
        this.stats.errorCount = 0;
        this.stats.successRate = 0;
        // Clear history
        this.runHistory.length = 0;
        this.runTimes.length = 0;
        // Clear caches
        this.processedTokens.clear();
        cache_1.globalCache.delete('aggregator:processed-tokens');
        // Reset pipeline stats
        this.tokenPipeline.resetStats();
        this.logger.info('Aggregator statistics and caches reset');
        this.emit('stats:reset');
    }
    /**
     * Get comprehensive system status
     */
    getSystemStatus() {
        const healthStatus = this.healthCheck.getOverallHealth();
        const services = healthStatus.services || [];
        return {
            aggregator: this.getStats(),
            pipeline: this.tokenPipeline.getStats(),
            health: {
                overall: healthStatus.healthy,
                services,
                unhealthyCount: services.filter(s => !s.healthy).length
            },
            caches: {
                processedTokens: this.processedTokens.size,
                blacklistedTokens: this.blacklistedTokens.size
            }
        };
    }
}
exports.TokenAggregatorService = TokenAggregatorService;
//# sourceMappingURL=token-aggregator.service.js.map