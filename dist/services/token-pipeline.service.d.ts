/**
 * Token Pipeline Service
 * Hive Mind Integration - Sequential API Processing Pipeline
 *
 * Processes tokens through complete workflow:
 * DEXScreener → filter → RugCheck → filter → Jupiter → filter → Solscan → filter → Store
 */
import { EventEmitter } from 'events';
import { CombinedTokenAnalysis, TokenFilterCriteria } from '../types/api.types';
import { DexScreenerService } from './dexscreener.service';
import { RugCheckService } from './rugcheck.service';
import { JupiterService } from './jupiter.service';
import { SolscanService } from './solscan.service';
export interface PipelineConfig {
    batchSize: number;
    maxConcurrent: number;
    timeoutMs: number;
    retryAttempts: number;
    cacheResults: boolean;
}
export interface PipelineStats {
    tokensProcessed: number;
    tokensFiltered: number;
    successRate: number;
    averageProcessingTime: number;
    errorCount: number;
    lastProcessedAt: Date;
}
export interface PipelineStageResult<T> {
    success: boolean;
    data?: T;
    filtered: boolean;
    filterReason?: string;
    processingTime: number;
    error?: string;
}
export declare class TokenPipelineService extends EventEmitter {
    private readonly dexScreenerService;
    private readonly rugCheckService;
    private readonly jupiterService;
    private readonly solscanService;
    private readonly config;
    private readonly logger;
    private readonly stats;
    private readonly processingTimes;
    private readonly maxProcessingTimeHistory;
    constructor(dexScreenerService: DexScreenerService, rugCheckService: RugCheckService, jupiterService: JupiterService, solscanService: SolscanService, config?: PipelineConfig);
    private setupEventListeners;
    /**
     * Process a single token through the complete pipeline
     */
    processToken(tokenAddress: string, filters: TokenFilterCriteria): Promise<CombinedTokenAnalysis | null>;
    /**
     * Process multiple tokens in parallel batches
     */
    processBatch(tokenAddresses: string[], filters: TokenFilterCriteria): Promise<CombinedTokenAnalysis[]>;
    private processTokenWithTimeout;
    private processConcurrent;
    private processDexScreenerStage;
    private processRugCheckStage;
    private processJupiterStage;
    private processSolscanStage;
    private createCombinedAnalysis;
    private calculateOverallScore;
    private createFailedAnalysis;
    private getCachedAnalysis;
    private cacheAnalysis;
    private updateStats;
    private recordProcessingTime;
    getStats(): PipelineStats;
    getConfig(): PipelineConfig;
    updateConfig(updates: Partial<PipelineConfig>): void;
    resetStats(): void;
}
//# sourceMappingURL=token-pipeline.service.d.ts.map