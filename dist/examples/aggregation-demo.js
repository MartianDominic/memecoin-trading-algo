"use strict";
/**
 * Token Aggregation Service Demo
 * Demonstrates comprehensive usage of TokenAggregatorService and TokenPipelineService
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.demonstrateTokenAggregation = demonstrateTokenAggregation;
const services_1 = require("../services");
const logger_1 = require("../utils/logger");
/**
 * Demo: Complete Token Aggregation System
 */
async function demonstrateTokenAggregation() {
    const logger = logger_1.Logger.getInstance();
    logger.info('Starting Token Aggregation Demo');
    // Initialize all services
    const dexScreenerService = new services_1.DexScreenerService();
    const rugCheckService = new services_1.RugCheckService();
    const jupiterService = new services_1.JupiterService();
    const solscanService = new services_1.SolscanService();
    // Define comprehensive filter criteria
    const filters = {
        // Age filters: tokens between 30 minutes and 24 hours old
        minAge: 0.5, // 30 minutes
        maxAge: 24, // 24 hours
        // Liquidity filters: minimum $5,000 liquidity
        minLiquidity: 5000,
        // Volume filters: minimum $1,000 24h volume
        minVolume: 1000,
        // Security filters: safety score ≥ 6, no honeypots
        minSafetyScore: 6,
        allowHoneypot: false,
        // Jupiter filters: routing must exist, max 10% slippage
        requireRouting: true,
        maxSlippage: 10,
        allowBlacklisted: false,
        // Creator filters: max 2 rugs, top 3 holders < 60%
        maxCreatorRugs: 2,
        maxTopHoldersPercentage: 60
    };
    // Create TokenAggregatorService with configuration
    const aggregator = new services_1.TokenAggregatorService(dexScreenerService, rugCheckService, jupiterService, solscanService, {
        cronSchedule: '*/5 * * * *', // Every 5 minutes
        maxTokensPerRun: 50,
        enableRealTimeEvents: true,
        enableDatabaseStorage: true,
        enableAutoScaling: true,
        filters,
        pipeline: {
            batchSize: 20,
            maxConcurrent: 10,
            timeoutMs: 90000,
            retryAttempts: 2,
            cacheResults: true
        }
    });
    // Set up event listeners
    setupEventListeners(aggregator);
    // Demo 1: Manual single run
    await demonstrateManualRun(aggregator);
    // Demo 2: Start scheduled aggregation
    await demonstrateScheduledAggregation(aggregator);
    // Demo 3: Pipeline-only processing
    await demonstratePipelineProcessing(dexScreenerService, rugCheckService, jupiterService, solscanService, filters);
    // Demo 4: Health monitoring
    await demonstrateHealthMonitoring(aggregator);
    logger.info('Token Aggregation Demo completed');
}
/**
 * Set up comprehensive event listeners
 */
function setupEventListeners(aggregator) {
    const logger = logger_1.Logger.getInstance();
    // Service lifecycle events
    aggregator.on('service:started', (data) => {
        logger.info('🚀 Aggregation service started', data);
    });
    aggregator.on('service:stopped', (data) => {
        logger.info('⏹️  Aggregation service stopped', data);
    });
    // Run lifecycle events
    aggregator.on('run:start', (runId) => {
        logger.info('🔄 Aggregation run started', { runId });
    });
    aggregator.on('run:complete', (run) => {
        logger.info('✅ Aggregation run completed', {
            runId: run.id,
            duration: run.endTime ? run.endTime.getTime() - run.startTime.getTime() : 0,
            tokensProcessed: run.tokensProcessed,
            tokensPassed: run.tokensPassed,
            status: run.status
        });
    });
    // Token discovery and processing events
    aggregator.on('token:discovered', (tokens) => {
        logger.info(`🔍 Discovered ${tokens.length} new tokens`, { count: tokens.length });
    });
    aggregator.on('token:passed', (analysis) => {
        logger.info('🎯 Token passed all filters', {
            address: analysis.address,
            score: analysis.overallScore,
            liquidity: analysis.dexScreener.liquidity,
            volume: analysis.dexScreener.volume24h,
            safetyScore: analysis.rugCheck.safetyScore,
            slippage: analysis.jupiter.slippageEstimate,
            creatorRugs: analysis.solscan.creatorInfo.ruggedTokens
        });
    });
    aggregator.on('token:stored', (analysis) => {
        logger.info('💾 Token stored in database', { address: analysis.address });
    });
    aggregator.on('token:blacklisted', (data) => {
        logger.warn('🚫 Token blacklisted', data);
    });
    // Configuration events
    aggregator.on('config:updated', (updates) => {
        logger.info('⚙️  Configuration updated', updates);
    });
    // Statistics events
    aggregator.on('stats:reset', () => {
        logger.info('📊 Statistics reset');
    });
}
/**
 * Demo: Manual aggregation run
 */
async function demonstrateManualRun(aggregator) {
    const logger = logger_1.Logger.getInstance();
    logger.info('--- Demo 1: Manual Aggregation Run ---');
    try {
        const run = await aggregator.runManualAggregation();
        logger.info('Manual run results:', {
            runId: run.id,
            tokensDiscovered: run.tokensDiscovered,
            tokensProcessed: run.tokensProcessed,
            tokensPassed: run.tokensPassed,
            status: run.status,
            errors: run.errors
        });
        // Show statistics
        const stats = aggregator.getStats();
        logger.info('Current statistics:', stats);
    }
    catch (error) {
        logger.error('Manual run failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
/**
 * Demo: Scheduled aggregation
 */
async function demonstrateScheduledAggregation(aggregator) {
    const logger = logger_1.Logger.getInstance();
    logger.info('--- Demo 2: Scheduled Aggregation (10 seconds) ---');
    // Start the service
    aggregator.start();
    // Let it run for a short period for demo
    await new Promise(resolve => setTimeout(resolve, 10000));
    // Check status
    const systemStatus = aggregator.getSystemStatus();
    logger.info('System status during operation:', systemStatus);
    // Get recent run history
    const runHistory = aggregator.getRunHistory(5);
    logger.info('Recent run history:', runHistory);
    // Stop the service
    aggregator.stop();
}
/**
 * Demo: Direct pipeline processing
 */
async function demonstratePipelineProcessing(dexScreenerService, rugCheckService, jupiterService, solscanService, filters) {
    const logger = logger_1.Logger.getInstance();
    logger.info('--- Demo 3: Direct Pipeline Processing ---');
    // Create pipeline service
    const pipeline = new services_1.TokenPipelineService(dexScreenerService, rugCheckService, jupiterService, solscanService);
    // Set up pipeline event listeners
    pipeline.on('stage:start', (stage, tokenAddress) => {
        logger.debug(`Pipeline stage started: ${stage} for ${tokenAddress}`);
    });
    pipeline.on('stage:complete', (stage, tokenAddress, result) => {
        logger.debug(`Pipeline stage completed: ${stage} for ${tokenAddress}`, {
            success: result.success,
            filtered: result.filtered,
            processingTime: result.processingTime
        });
    });
    pipeline.on('token:complete', (analysis) => {
        logger.info('Pipeline token analysis complete', {
            address: analysis.address,
            passed: analysis.passed,
            score: analysis.overallScore
        });
    });
    // Test with some example token addresses (these would be real Solana token addresses)
    const testTokens = [
        'So11111111111111111111111111111111111111112', // SOL
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC
    ];
    try {
        // Process tokens in batch
        const results = await pipeline.processBatch(testTokens, filters);
        logger.info('Batch processing results:', {
            totalProcessed: results.length,
            passed: results.filter(r => r.passed).length,
            failed: results.filter(r => !r.passed).length
        });
        // Show individual results
        results.forEach(result => {
            logger.info(`Token ${result.address}:`, {
                passed: result.passed,
                score: result.overallScore,
                failedFilters: result.failedFilters
            });
        });
        // Show pipeline statistics
        const pipelineStats = pipeline.getStats();
        logger.info('Pipeline statistics:', pipelineStats);
    }
    catch (error) {
        logger.error('Pipeline processing failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
/**
 * Demo: Health monitoring
 */
async function demonstrateHealthMonitoring(aggregator) {
    const logger = logger_1.Logger.getInstance();
    logger.info('--- Demo 4: Health Monitoring ---');
    try {
        // Get comprehensive health status
        const healthStatus = await aggregator.getHealthStatus();
        logger.info('Health status:', {
            aggregatorHealthy: healthStatus.aggregator.healthy,
            message: healthStatus.aggregator.message,
            servicesHealthy: healthStatus.services.filter(s => s.healthy).length,
            servicesTotal: healthStatus.services.length
        });
        // Show individual service health
        healthStatus.services.forEach(service => {
            logger.info(`Service ${service.service}:`, {
                healthy: service.healthy,
                latency: service.latency,
                errorRate: service.errorRate,
                endpoint: service.endpoint
            });
        });
        // Show system status
        const systemStatus = aggregator.getSystemStatus();
        logger.info('Complete system status:', {
            aggregator: systemStatus.aggregator,
            pipeline: systemStatus.pipeline,
            caches: systemStatus.caches
        });
    }
    catch (error) {
        logger.error('Health monitoring failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
/**
 * Demo: Configuration management
 */
async function demonstrateConfigurationManagement(aggregator) {
    const logger = logger_1.Logger.getInstance();
    logger.info('--- Demo 5: Configuration Management ---');
    // Get current configuration
    const currentConfig = aggregator.getConfig();
    logger.info('Current configuration:', currentConfig);
    // Update configuration
    aggregator.updateConfig({
        maxTokensPerRun: 25,
        pipeline: {
            batchSize: 10,
            maxConcurrent: 5,
            timeoutMs: 60000,
            retryAttempts: 3,
            cacheResults: true
        }
    });
    logger.info('Configuration updated');
    // Add token to blacklist
    aggregator.addToBlacklist('blacklisted-token-address', 'Demo blacklist');
    // Remove from blacklist
    const removed = aggregator.removeFromBlacklist('blacklisted-token-address');
    logger.info('Blacklist removal:', { removed });
    // Reset statistics for clean slate
    aggregator.resetStats();
    logger.info('Statistics reset');
}
/**
 * Demo: Error handling and recovery
 */
async function demonstrateErrorHandling(aggregator) {
    const logger = logger_1.Logger.getInstance();
    logger.info('--- Demo 6: Error Handling ---');
    // Set up error event listener
    aggregator.on('pipeline:error', (error, context) => {
        logger.error('Pipeline error caught:', { error: error.message, context });
    });
    try {
        // This would simulate processing with invalid token addresses
        const invalidTokens = ['invalid-address-1', 'invalid-address-2'];
        // The pipeline should handle these gracefully
        const pipeline = new services_1.TokenPipelineService(new services_1.DexScreenerService(), new services_1.RugCheckService(), new services_1.JupiterService(), new services_1.SolscanService());
        const results = await pipeline.processBatch(invalidTokens, {});
        logger.info('Error handling results:', {
            processed: results.length,
            errors: results.filter(r => !r.passed).length
        });
    }
    catch (error) {
        logger.error('Error handling demo failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
// Run demo if this file is executed directly
if (require.main === module) {
    demonstrateTokenAggregation().catch(console.error);
}
//# sourceMappingURL=aggregation-demo.js.map