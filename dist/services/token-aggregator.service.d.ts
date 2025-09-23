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
import { EventEmitter } from 'events';
import { TokenFilterCriteria, ServiceHealthCheck } from '../types/api.types';
import { PipelineConfig } from './token-pipeline.service';
import { DexScreenerService } from './dexscreener.service';
import { RugCheckService } from './rugcheck.service';
import { JupiterService } from './jupiter.service';
import { SolscanService } from './solscan.service';
export interface AggregatorConfig {
    cronSchedule: string;
    maxTokensPerRun: number;
    enableRealTimeEvents: boolean;
    enableDatabaseStorage: boolean;
    enableAutoScaling: boolean;
    filters: TokenFilterCriteria;
    pipeline: PipelineConfig;
}
export interface AggregatorStats {
    totalRuns: number;
    tokensDiscovered: number;
    tokensProcessed: number;
    tokensPassed: number;
    tokensStored: number;
    lastRunAt: Date;
    nextRunAt: Date;
    averageRunTime: number;
    isRunning: boolean;
    errorCount: number;
    successRate: number;
}
export interface TokenDiscoveryResult {
    newTokens: string[];
    totalDiscovered: number;
    alreadyProcessed: number;
    discoveryTime: number;
}
export interface AggregationRun {
    id: string;
    startTime: Date;
    endTime?: Date;
    tokensDiscovered: number;
    tokensProcessed: number;
    tokensPassed: number;
    errors: string[];
    status: 'running' | 'completed' | 'failed';
}
export declare class TokenAggregatorService extends EventEmitter {
    private readonly dexScreenerService;
    private readonly rugCheckService;
    private readonly jupiterService;
    private readonly solscanService;
    private readonly config;
    private readonly logger;
    private cronJob;
    private readonly tokenPipeline;
    private readonly healthCheck;
    private readonly stats;
    private readonly runHistory;
    private readonly maxRunHistory;
    private readonly runTimes;
    private readonly maxRunTimeHistory;
    private readonly defaultFilters;
    private readonly processedTokens;
    private readonly blacklistedTokens;
    constructor(dexScreenerService: DexScreenerService, rugCheckService: RugCheckService, jupiterService: JupiterService, solscanService: SolscanService, config?: AggregatorConfig);
    private setupEventListeners;
    /**
     * Start the aggregation service with cron scheduling
     */
    start(): void;
    /**
     * Stop the aggregation service
     */
    stop(): void;
    /**
     * Run a single aggregation cycle
     */
    runAggregation(): Promise<AggregationRun>;
    /**
     * Discover new tokens from DEXScreener
     */
    private discoverNewTokens;
    /**
     * Verify that all services are healthy before processing
     */
    private verifyServiceHealth;
    /**
     * Handle completed token analysis
     */
    private handleTokenAnalysisComplete;
    /**
     * Store token analyses in database (placeholder)
     */
    private storeTokenAnalyses;
    /**
     * Update processed tokens cache
     */
    private updateProcessedTokensCache;
    /**
     * Load previously processed tokens from cache
     */
    private loadProcessedTokens;
    /**
     * Update next run time based on cron schedule
     */
    private updateNextRunTime;
    /**
     * Update aggregation run statistics
     */
    private updateRunStats;
    /**
     * Record run time for averaging
     */
    private recordRunTime;
    /**
     * Add token to blacklist
     */
    addToBlacklist(tokenAddress: string, reason?: string): void;
    /**
     * Remove token from blacklist
     */
    removeFromBlacklist(tokenAddress: string): boolean;
    /**
     * Run manual aggregation (outside of cron schedule)
     */
    runManualAggregation(): Promise<AggregationRun>;
    /**
     * Get aggregation service statistics
     */
    getStats(): AggregatorStats;
    /**
     * Get recent run history
     */
    getRunHistory(limit?: number): AggregationRun[];
    /**
     * Get service configuration
     */
    getConfig(): AggregatorConfig;
    /**
     * Update service configuration
     */
    updateConfig(updates: Partial<AggregatorConfig>): void;
    /**
     * Get service health status
     */
    getHealthStatus(): Promise<{
        aggregator: {
            healthy: boolean;
            message: string;
        };
        services: ServiceHealthCheck[];
    }>;
    /**
     * Reset all statistics and caches
     */
    resetStats(): void;
    /**
     * Get comprehensive system status
     */
    getSystemStatus(): {
        aggregator: AggregatorStats;
        pipeline: {
            tokensProcessed: number;
            tokensFiltered: number;
            successRate: number;
            averageProcessingTime: number;
            errorCount: number;
            lastProcessedAt: Date;
        };
        health: {
            overall: boolean;
            services: ServiceHealthCheck[];
            unhealthyCount: number;
        };
        caches: {
            processedTokens: number;
            blacklistedTokens: number;
        };
    };
}
//# sourceMappingURL=token-aggregator.service.d.ts.map