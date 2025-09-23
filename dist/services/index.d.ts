/**
 * API Services Index - Unified Export
 * Hive Mind Integration - Complete API Service Layer
 */
export { DexScreenerService } from './dexscreener.service';
export { RugCheckService } from './rugcheck.service';
export { JupiterService } from './jupiter.service';
export { SolscanService } from './solscan.service';
export { TokenPipelineService, type PipelineConfig, type PipelineStats } from './token-pipeline.service';
export { TokenAggregatorService, type AggregatorConfig, type AggregatorStats } from './token-aggregator.service';
export { HealthCheckService, healthCheckService, type ApiService, type SystemHealthReport } from './health-check.service';
export { BlockchainService, type BlockchainAPIConfig } from './blockchain.service';
import { CombinedTokenAnalysis, TokenFilterCriteria, ApiResponse } from '../types/api.types';
export declare class TokenAnalysisService {
    private readonly logger;
    private readonly dexScreener;
    private readonly rugCheck;
    private readonly jupiter;
    private readonly solscan;
    constructor();
    /**
     * Perform comprehensive token analysis using all services
     */
    analyzeToken(tokenAddress: string, filters?: TokenFilterCriteria): Promise<ApiResponse<CombinedTokenAnalysis>>;
    private buildCombinedAnalysis;
    private getDefaultDexData;
    private getDefaultRugData;
    private getDefaultJupiterData;
    private getDefaultSolscanData;
    /**
     * Get health status of all services
     */
    getSystemHealth(): Promise<ApiResponse<import("./health-check.service").SystemHealthReport>>;
    /**
     * Get performance statistics for all services
     */
    getServiceStats(): Promise<{
        dexScreener: {
            requests: number;
            backoff: number;
            cacheHits: number;
        };
        rugCheck: {
            requests: number;
            backoff: number;
            cacheHits: number;
        };
        jupiter: {
            requests: number;
            backoff: number;
            cacheHits: number;
            blacklistedTokens: number;
        };
        solscan: {
            requests: number;
            backoff: number;
            cacheHits: number;
        };
        system: Record<string, unknown>;
    }>;
}
export declare const tokenAnalysisService: TokenAnalysisService;
//# sourceMappingURL=index.d.ts.map