/**
 * Token Pipeline Service
 * Hive Mind Integration - Sequential API Processing Pipeline
 *
 * Processes tokens through complete workflow:
 * DEXScreener → filter → RugCheck → filter → Jupiter → filter → Solscan → filter → Store
 */

import { EventEmitter } from 'events';
import {
  CombinedTokenAnalysis,
  TokenFilterCriteria,
  DexScreenerTokenData,
  RugCheckResult,
  JupiterTokenData,
  SolscanTokenData,
  ApiResponse
} from '../types/api.types';
import { DexScreenerService } from './dexscreener.service';
import { RugCheckService } from './rugcheck.service';
import { JupiterService } from './jupiter.service';
import { SolscanService } from './solscan.service';
import { Logger } from '../utils/logger';
import { globalCache } from '../utils/cache';

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

export class TokenPipelineService extends EventEmitter {
  private readonly logger = Logger.getInstance();
  private readonly stats: PipelineStats = {
    tokensProcessed: 0,
    tokensFiltered: 0,
    successRate: 0,
    averageProcessingTime: 0,
    errorCount: 0,
    lastProcessedAt: new Date()
  };

  private readonly processingTimes: number[] = [];
  private readonly maxProcessingTimeHistory = 1000;

  constructor(
    private readonly dexScreenerService: DexScreenerService,
    private readonly rugCheckService: RugCheckService,
    private readonly jupiterService: JupiterService,
    private readonly solscanService: SolscanService,
    private readonly config: PipelineConfig = {
      batchSize: 50,
      maxConcurrent: 5,
      timeoutMs: 60000,
      retryAttempts: 2,
      cacheResults: true
    }
  ) {
    super();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.on('stage:start', (stage: string, tokenAddress: string) => {
      this.logger.debug(`Pipeline stage started: ${stage}`, { stage, tokenAddress });
    });

    this.on('stage:complete', (stage: string, tokenAddress: string, result: PipelineStageResult<unknown>) => {
      this.logger.debug(`Pipeline stage completed: ${stage}`, {
        stage,
        tokenAddress,
        success: result.success,
        filtered: result.filtered,
        processingTime: result.processingTime
      });
    });

    this.on('token:complete', (analysis: CombinedTokenAnalysis) => {
      this.updateStats(analysis);
    });

    this.on('pipeline:error', (error: Error, context: Record<string, unknown>) => {
      this.logger.error('Pipeline error', { error: error.message, ...context });
      this.stats.errorCount++;
    });
  }

  /**
   * Process a single token through the complete pipeline
   */
  async processToken(
    tokenAddress: string,
    filters: TokenFilterCriteria
  ): Promise<CombinedTokenAnalysis | null> {
    const startTime = Date.now();

    try {
      this.logger.info(`Starting pipeline processing for token: ${tokenAddress}`);

      // Check cache first
      if (this.config.cacheResults) {
        const cached = this.getCachedAnalysis(tokenAddress);
        if (cached) {
          this.logger.debug(`Returning cached analysis for ${tokenAddress}`);
          return cached;
        }
      }

      // Stage 1: DEXScreener Analysis
      const dexResult = await this.processDexScreenerStage(tokenAddress, filters);
      if (!dexResult.success || dexResult.filtered) {
        return this.createFailedAnalysis(tokenAddress, 'dexscreener', dexResult.filterReason || dexResult.error);
      }

      // Stage 2: RugCheck Security Analysis
      const rugResult = await this.processRugCheckStage(tokenAddress, filters);
      if (!rugResult.success || rugResult.filtered) {
        return this.createFailedAnalysis(tokenAddress, 'rugcheck', rugResult.filterReason || rugResult.error);
      }

      // Stage 3: Jupiter Routing Analysis
      const jupiterResult = await this.processJupiterStage(tokenAddress, filters);
      if (!jupiterResult.success || jupiterResult.filtered) {
        return this.createFailedAnalysis(tokenAddress, 'jupiter', jupiterResult.filterReason || jupiterResult.error);
      }

      // Stage 4: Solscan Creator Analysis
      const solscanResult = await this.processSolscanStage(tokenAddress, filters);
      if (!solscanResult.success || solscanResult.filtered) {
        return this.createFailedAnalysis(tokenAddress, 'solscan', solscanResult.filterReason || solscanResult.error);
      }

      // Create combined analysis
      const analysis = this.createCombinedAnalysis(
        tokenAddress,
        dexResult.data!,
        rugResult.data!,
        jupiterResult.data!,
        solscanResult.data!
      );

      // Calculate processing time
      const processingTime = Date.now() - startTime;
      this.recordProcessingTime(processingTime);

      // Cache result
      if (this.config.cacheResults) {
        this.cacheAnalysis(tokenAddress, analysis);
      }

      // Emit completion event
      this.emit('token:complete', analysis);

      this.logger.info(`Pipeline processing completed for ${tokenAddress}`, {
        tokenAddress,
        passed: analysis.passed,
        score: analysis.overallScore,
        processingTime
      });

      return analysis;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.recordProcessingTime(processingTime);

      this.emit('pipeline:error', error as Error, { tokenAddress, processingTime });

      return this.createFailedAnalysis(
        tokenAddress,
        'pipeline',
        error instanceof Error ? error.message : 'Unknown pipeline error'
      );
    }
  }

  /**
   * Process multiple tokens in parallel batches
   */
  async processBatch(
    tokenAddresses: string[],
    filters: TokenFilterCriteria
  ): Promise<CombinedTokenAnalysis[]> {
    this.logger.info(`Processing batch of ${tokenAddresses.length} tokens`);

    const results: CombinedTokenAnalysis[] = [];

    // Process in chunks to manage concurrency
    for (let i = 0; i < tokenAddresses.length; i += this.config.batchSize) {
      const batch = tokenAddresses.slice(i, i + this.config.batchSize);

      const batchPromises = batch.map(address =>
        this.processTokenWithTimeout(address, filters)
      );

      // Process batch with limited concurrency
      const batchResults = await this.processConcurrent(batchPromises, this.config.maxConcurrent);

      // Filter out nulls and add to results
      results.push(...batchResults.filter(result => result !== null) as CombinedTokenAnalysis[]);

      this.logger.debug(`Batch ${Math.floor(i / this.config.batchSize) + 1} completed`, {
        processed: batch.length,
        successful: batchResults.filter(r => r !== null).length
      });
    }

    this.logger.info(`Batch processing completed`, {
      total: tokenAddresses.length,
      successful: results.length,
      successRate: (results.length / tokenAddresses.length) * 100
    });

    return results;
  }

  private async processTokenWithTimeout(
    tokenAddress: string,
    filters: TokenFilterCriteria
  ): Promise<CombinedTokenAnalysis | null> {
    return Promise.race([
      this.processToken(tokenAddress, filters),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Pipeline timeout')), this.config.timeoutMs)
      )
    ]).catch(error => {
      this.logger.warn(`Token processing failed: ${tokenAddress}`, { error: error.message });
      return null;
    });
  }

  private async processConcurrent<T>(
    promises: Promise<T>[],
    maxConcurrent: number
  ): Promise<T[]> {
    const results: T[] = [];

    for (let i = 0; i < promises.length; i += maxConcurrent) {
      const chunk = promises.slice(i, i + maxConcurrent);
      const chunkResults = await Promise.allSettled(chunk);

      results.push(...chunkResults.map(result =>
        result.status === 'fulfilled' ? result.value : null
      ).filter(result => result !== null) as T[]);
    }

    return results;
  }

  private async processDexScreenerStage(
    tokenAddress: string,
    filters: TokenFilterCriteria
  ): Promise<PipelineStageResult<DexScreenerTokenData>> {
    const stage = 'dexscreener';
    const startTime = Date.now();

    this.emit('stage:start', stage, tokenAddress);

    try {
      const response = await this.dexScreenerService.getTokenData(tokenAddress, filters);
      const processingTime = Date.now() - startTime;

      if (!response.success || !response.data || response.data.length === 0) {
        const result: PipelineStageResult<DexScreenerTokenData> = {
          success: false,
          filtered: true,
          filterReason: 'No DEXScreener data found',
          processingTime,
          error: response.error
        };

        this.emit('stage:complete', stage, tokenAddress, result);
        return result;
      }

      const tokenData = response.data[0];
      const result: PipelineStageResult<DexScreenerTokenData> = {
        success: true,
        data: tokenData,
        filtered: tokenData.filtered,
        filterReason: tokenData.filterReason,
        processingTime
      };

      this.emit('stage:complete', stage, tokenAddress, result);
      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const result: PipelineStageResult<DexScreenerTokenData> = {
        success: false,
        filtered: true,
        filterReason: 'DEXScreener API error',
        processingTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.emit('stage:complete', stage, tokenAddress, result);
      return result;
    }
  }

  private async processRugCheckStage(
    tokenAddress: string,
    filters: TokenFilterCriteria
  ): Promise<PipelineStageResult<RugCheckResult>> {
    const stage = 'rugcheck';
    const startTime = Date.now();

    this.emit('stage:start', stage, tokenAddress);

    try {
      const response = await this.rugCheckService.analyzeToken(tokenAddress, filters);
      const processingTime = Date.now() - startTime;

      if (!response.success || !response.data) {
        const result: PipelineStageResult<RugCheckResult> = {
          success: false,
          filtered: true,
          filterReason: 'RugCheck analysis failed',
          processingTime,
          error: response.error
        };

        this.emit('stage:complete', stage, tokenAddress, result);
        return result;
      }

      const rugData = response.data;
      const result: PipelineStageResult<RugCheckResult> = {
        success: true,
        data: rugData,
        filtered: rugData.filtered,
        filterReason: rugData.filterReason,
        processingTime
      };

      this.emit('stage:complete', stage, tokenAddress, result);
      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const result: PipelineStageResult<RugCheckResult> = {
        success: false,
        filtered: true,
        filterReason: 'RugCheck API error',
        processingTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.emit('stage:complete', stage, tokenAddress, result);
      return result;
    }
  }

  private async processJupiterStage(
    tokenAddress: string,
    filters: TokenFilterCriteria
  ): Promise<PipelineStageResult<JupiterTokenData>> {
    const stage = 'jupiter';
    const startTime = Date.now();

    this.emit('stage:start', stage, tokenAddress);

    try {
      const response = await this.jupiterService.analyzeToken(tokenAddress, filters);
      const processingTime = Date.now() - startTime;

      if (!response.success || !response.data) {
        const result: PipelineStageResult<JupiterTokenData> = {
          success: false,
          filtered: true,
          filterReason: 'Jupiter routing analysis failed',
          processingTime,
          error: response.error
        };

        this.emit('stage:complete', stage, tokenAddress, result);
        return result;
      }

      const jupiterData = response.data;
      const result: PipelineStageResult<JupiterTokenData> = {
        success: true,
        data: jupiterData,
        filtered: jupiterData.filtered,
        filterReason: jupiterData.filterReason,
        processingTime
      };

      this.emit('stage:complete', stage, tokenAddress, result);
      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const result: PipelineStageResult<JupiterTokenData> = {
        success: false,
        filtered: true,
        filterReason: 'Jupiter API error',
        processingTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.emit('stage:complete', stage, tokenAddress, result);
      return result;
    }
  }

  private async processSolscanStage(
    tokenAddress: string,
    filters: TokenFilterCriteria
  ): Promise<PipelineStageResult<SolscanTokenData>> {
    const stage = 'solscan';
    const startTime = Date.now();

    this.emit('stage:start', stage, tokenAddress);

    try {
      const response = await this.solscanService.analyzeToken(tokenAddress, filters);
      const processingTime = Date.now() - startTime;

      if (!response.success || !response.data) {
        const result: PipelineStageResult<SolscanTokenData> = {
          success: false,
          filtered: true,
          filterReason: 'Solscan creator analysis failed',
          processingTime,
          error: response.error
        };

        this.emit('stage:complete', stage, tokenAddress, result);
        return result;
      }

      const solscanData = response.data;
      const result: PipelineStageResult<SolscanTokenData> = {
        success: true,
        data: solscanData,
        filtered: solscanData.filtered,
        filterReason: solscanData.filterReason,
        processingTime
      };

      this.emit('stage:complete', stage, tokenAddress, result);
      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const result: PipelineStageResult<SolscanTokenData> = {
        success: false,
        filtered: true,
        filterReason: 'Solscan API error',
        processingTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.emit('stage:complete', stage, tokenAddress, result);
      return result;
    }
  }

  private createCombinedAnalysis(
    tokenAddress: string,
    dexScreener: DexScreenerTokenData,
    rugCheck: RugCheckResult,
    jupiter: JupiterTokenData,
    solscan: SolscanTokenData
  ): CombinedTokenAnalysis {
    // Calculate overall score (0-100)
    const overallScore = this.calculateOverallScore(dexScreener, rugCheck, jupiter, solscan);

    // Determine if token passed all filters
    const passed = !dexScreener.filtered && !rugCheck.filtered && !jupiter.filtered && !solscan.filtered;

    // Collect all failed filter reasons
    const failedFilters: string[] = [];
    if (dexScreener.filterReason) failedFilters.push(`DEX: ${dexScreener.filterReason}`);
    if (rugCheck.filterReason) failedFilters.push(`Security: ${rugCheck.filterReason}`);
    if (jupiter.filterReason) failedFilters.push(`Routing: ${jupiter.filterReason}`);
    if (solscan.filterReason) failedFilters.push(`Creator: ${solscan.filterReason}`);

    return {
      address: tokenAddress.toLowerCase(),
      dexScreener,
      rugCheck,
      jupiter,
      solscan,
      overallScore,
      passed,
      failedFilters,
      timestamp: new Date()
    };
  }

  private calculateOverallScore(
    dexScreener: DexScreenerTokenData,
    rugCheck: RugCheckResult,
    jupiter: JupiterTokenData,
    solscan: SolscanTokenData
  ): number {
    let score = 0;
    let weights = 0;

    // DEXScreener contribution (25% weight)
    const dexWeight = 25;
    let dexScore = 50; // Base score

    if (dexScreener.liquidity > 10000) dexScore += 20;
    if (dexScreener.volume24h > 5000) dexScore += 15;
    if (dexScreener.age < 24 && dexScreener.age > 1) dexScore += 15;

    score += (dexScore * dexWeight) / 100;
    weights += dexWeight;

    // RugCheck contribution (35% weight - most important)
    const rugWeight = 35;
    const rugScore = Math.max(0, Math.min(100, (rugCheck.safetyScore / 10) * 100));

    score += (rugScore * rugWeight) / 100;
    weights += rugWeight;

    // Jupiter contribution (20% weight)
    const jupiterWeight = 20;
    let jupiterScore = jupiter.routingAvailable ? 60 : 0;

    if (jupiter.slippageEstimate < 5) jupiterScore += 25;
    else if (jupiter.slippageEstimate < 10) jupiterScore += 15;

    if (!jupiter.blacklisted) jupiterScore += 15;

    score += (jupiterScore * jupiterWeight) / 100;
    weights += jupiterWeight;

    // Solscan contribution (20% weight)
    const solscanWeight = 20;
    let solscanScore = 50; // Base score

    if (solscan.creatorInfo.ruggedTokens === 0) solscanScore += 25;
    else if (solscan.creatorInfo.ruggedTokens <= 1) solscanScore += 10;

    if (solscan.topHoldersPercentage < 40) solscanScore += 15;
    else if (solscan.topHoldersPercentage < 60) solscanScore += 5;

    if (solscan.fundingPattern === 'organic') solscanScore += 10;

    score += (solscanScore * solscanWeight) / 100;
    weights += solscanWeight;

    return Math.min(100, Math.max(0, score));
  }

  private createFailedAnalysis(
    tokenAddress: string,
    failedStage: string,
    reason?: string
  ): CombinedTokenAnalysis {
    // Create minimal failed analysis
    const timestamp = new Date();

    return {
      address: tokenAddress.toLowerCase(),
      dexScreener: {
        address: tokenAddress.toLowerCase(),
        symbol: 'UNKNOWN',
        name: 'Unknown Token',
        launchTimestamp: 0,
        price: 0,
        marketCap: 0,
        volume24h: 0,
        liquidity: 0,
        age: 0,
        filtered: true,
        filterReason: failedStage === 'dexscreener' ? reason : 'Failed before DEXScreener analysis'
      },
      rugCheck: {
        address: tokenAddress.toLowerCase(),
        honeypotRisk: true,
        mintAuthority: true,
        freezeAuthority: true,
        liquidityLocked: false,
        holderConcentration: 100,
        safetyScore: 0,
        risks: ['Analysis failed'],
        warnings: [],
        filtered: true,
        filterReason: failedStage === 'rugcheck' ? reason : 'Failed before security analysis'
      },
      jupiter: {
        address: tokenAddress.toLowerCase(),
        routingAvailable: false,
        slippageEstimate: 100,
        spread: 100,
        volume24h: 0,
        blacklisted: true,
        routeCount: 0,
        filtered: true,
        filterReason: failedStage === 'jupiter' ? reason : 'Failed before routing analysis'
      },
      solscan: {
        address: tokenAddress.toLowerCase(),
        creatorWallet: 'unknown',
        creatorInfo: {
          address: 'unknown',
          createdTokens: 0,
          ruggedTokens: 999,
          successfulTokens: 0,
          successRate: 0,
          firstTokenDate: timestamp,
          averageHolding: 0
        },
        topHolders: [],
        topHoldersPercentage: 100,
        fundingPattern: 'suspicious',
        filtered: true,
        filterReason: failedStage === 'solscan' ? reason : 'Failed before creator analysis'
      },
      overallScore: 0,
      passed: false,
      failedFilters: [`${failedStage}: ${reason || 'Analysis failed'}`],
      timestamp
    };
  }

  private getCachedAnalysis(tokenAddress: string): CombinedTokenAnalysis | null {
    return globalCache.get<CombinedTokenAnalysis>(`pipeline:analysis:${tokenAddress.toLowerCase()}`);
  }

  private cacheAnalysis(tokenAddress: string, analysis: CombinedTokenAnalysis): void {
    globalCache.set(`pipeline:analysis:${tokenAddress.toLowerCase()}`, analysis, 600); // 10 minutes
  }

  private updateStats(analysis: CombinedTokenAnalysis): void {
    this.stats.tokensProcessed++;
    this.stats.lastProcessedAt = new Date();

    if (!analysis.passed) {
      this.stats.tokensFiltered++;
    }

    this.stats.successRate = ((this.stats.tokensProcessed - this.stats.tokensFiltered) / this.stats.tokensProcessed) * 100;

    // Update average processing time
    if (this.processingTimes.length > 0) {
      this.stats.averageProcessingTime = this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
    }
  }

  private recordProcessingTime(time: number): void {
    this.processingTimes.push(time);

    // Keep only recent processing times
    if (this.processingTimes.length > this.maxProcessingTimeHistory) {
      this.processingTimes.shift();
    }
  }

  getStats(): PipelineStats {
    return { ...this.stats };
  }

  getConfig(): PipelineConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<PipelineConfig>): void {
    Object.assign(this.config, updates);
    this.logger.info('Pipeline configuration updated', updates);
  }

  resetStats(): void {
    this.stats.tokensProcessed = 0;
    this.stats.tokensFiltered = 0;
    this.stats.successRate = 0;
    this.stats.averageProcessingTime = 0;
    this.stats.errorCount = 0;
    this.stats.lastProcessedAt = new Date();
    this.processingTimes.length = 0;

    this.logger.info('Pipeline statistics reset');
  }
}