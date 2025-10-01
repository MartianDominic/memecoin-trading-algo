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
import * as cron from 'node-cron';
import {
  CombinedTokenAnalysis,
  TokenFilterCriteria,
  DexScreenerTokenData,
  ServiceHealthCheck
} from '../types/api.types';
import { TokenPipelineService, PipelineConfig } from './token-pipeline.service';
import { DexScreenerService } from './dexscreener.service';
import { RugCheckService } from './rugcheck.service';
import { JupiterService } from './jupiter.service';
import { SolscanService } from './solscan.service';
import { HealthCheckService } from './health-check.service';
import { Logger } from '../utils/logger';
import { globalCache } from '../utils/cache';

export interface AggregatorConfig {
  cronSchedule: string; // Default: '*/5 * * * *' (every 5 minutes)
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

export class TokenAggregatorService extends EventEmitter {
  private readonly logger = Logger.getInstance();
  private cronJob: cron.ScheduledTask | null = null;
  private readonly tokenPipeline: TokenPipelineService;
  private readonly healthCheck: HealthCheckService;

  private readonly stats: AggregatorStats = {
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

  private readonly runHistory: AggregationRun[] = [];
  private readonly maxRunHistory = 100;
  private readonly runTimes: number[] = [];
  private readonly maxRunTimeHistory = 50;

  // Comprehensive filter criteria matching requirements
  private readonly defaultFilters: TokenFilterCriteria = {
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

  private readonly processedTokens = new Set<string>();
  private readonly blacklistedTokens = new Set<string>();

  constructor(
    private readonly dexScreenerService: DexScreenerService,
    private readonly rugCheckService: RugCheckService,
    private readonly jupiterService: JupiterService,
    private readonly solscanService: SolscanService,
    private readonly config: AggregatorConfig = {
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
    }
  ) {
    super();

    // Merge default filters with config
    this.config.filters = { ...this.defaultFilters, ...this.config.filters };

    // Initialize services
    this.tokenPipeline = new TokenPipelineService(
      this.dexScreenerService,
      this.rugCheckService,
      this.jupiterService,
      this.solscanService,
      this.config.pipeline
    );

    this.healthCheck = new HealthCheckService([
      this.dexScreenerService,
      this.rugCheckService,
      this.jupiterService,
      this.solscanService
    ]);

    this.setupEventListeners();
    this.loadProcessedTokens();
  }

  private setupEventListeners(): void {
    // Pipeline events
    this.tokenPipeline.on('token:complete', (analysis: CombinedTokenAnalysis) => {
      this.handleTokenAnalysisComplete(analysis);
    });

    this.tokenPipeline.on('pipeline:error', (error: Error, context: Record<string, unknown>) => {
      this.logger.error('Pipeline error in aggregator', { error: error.message, ...context });
      this.stats.errorCount++;
    });

    // Aggregator events
    this.on('run:start', (runId: string) => {
      this.logger.info(`Aggregation run started: ${runId}`);
      this.stats.isRunning = true;
    });

    this.on('run:complete', (run: AggregationRun) => {
      this.logger.info(`Aggregation run completed: ${run.id}`, {
        tokensProcessed: run.tokensProcessed,
        tokensPassed: run.tokensPassed,
        duration: run.endTime ? run.endTime.getTime() - run.startTime.getTime() : 0
      });
      this.stats.isRunning = false;
      this.updateRunStats(run);
    });

    this.on('token:discovered', (tokens: string[]) => {
      this.logger.debug(`Discovered ${tokens.length} new tokens`);
    });

    this.on('token:passed', (analysis: CombinedTokenAnalysis) => {
      this.logger.info(`Token passed all filters: ${analysis.address}`, {
        address: analysis.address,
        score: analysis.overallScore,
        liquidity: analysis.dexScreener.liquidity,
        volume: analysis.dexScreener.volume24h,
        safetyScore: analysis.rugCheck.safetyScore
      });
    });

    this.on('token:stored', (analysis: CombinedTokenAnalysis) => {
      this.logger.debug(`Token stored in database: ${analysis.address}`);
      this.stats.tokensStored++;
    });
  }

  /**
   * Start the aggregation service with cron scheduling
   */
  start(): void {
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
  stop(): void {
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
  async runAggregation(): Promise<AggregationRun> {
    const runId = `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    const run: AggregationRun = {
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
      const analysisResults = await this.tokenPipeline.processBatch(
        discoveryResult.newTokens,
        this.config.filters
      );

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

    } catch (error) {
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
    } finally {
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
  private async discoverNewTokens(): Promise<TokenDiscoveryResult> {
    const startTime = Date.now();

    try {
      // Get trending tokens from Solana
      const response = await this.dexScreenerService.getNewTokens('solana', this.config.filters);

      if (!response.success || !response.data) {
        throw new Error(`Token discovery failed: ${response.error}`);
      }

      const allTokens = response.data;
      const newTokens: string[] = [];
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

    } catch (error) {
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
  private async verifyServiceHealth(): Promise<void> {
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
  private handleTokenAnalysisComplete(analysis: CombinedTokenAnalysis): void {
    this.stats.tokensProcessed++;

    if (analysis.passed) {
      this.stats.tokensPassed++;
      this.emit('token:passed', analysis);
    } else {
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
   * Store token analyses in database
   */
  private async storeTokenAnalyses(analyses: CombinedTokenAnalysis[]): Promise<void> {
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      for (const analysis of analyses) {
        await prisma.$transaction(async (tx) => {
          // Upsert token with latest data
          const token = await tx.token.upsert({
            where: { address: analysis.address },
            update: {
              symbol: analysis.symbol,
              name: analysis.name,
              price: analysis.currentPrice,
              marketCap: analysis.marketCap,
              volume24h: analysis.volume24h,
              liquidity: analysis.liquidity,
              rugScore: analysis.rugScore,
              safetyScore: analysis.safetyScore,
              overallScore: analysis.overallScore,
              updatedAt: new Date()
            },
            create: {
              address: analysis.address,
              symbol: analysis.symbol,
              name: analysis.name,
              decimals: analysis.decimals || 9,
              price: analysis.currentPrice,
              marketCap: analysis.marketCap,
              volume24h: analysis.volume24h,
              liquidity: analysis.liquidity,
              rugScore: analysis.rugScore,
              safetyScore: analysis.safetyScore,
              overallScore: analysis.overallScore,
              chain: 'solana'
            }
          });

          // Store price snapshot
          await tx.priceData.create({
            data: {
              tokenId: token.id,
              price: analysis.currentPrice,
              change24h: analysis.priceChange24h,
              volume: analysis.volume24h
            }
          });

          // Store safety assessment
          await tx.safetyScore.create({
            data: {
              tokenId: token.id,
              rugScore: analysis.rugScore || 0,
              liquidityScore: analysis.liquidityScore || 0,
              ownershipScore: analysis.holderScore || 0,
              overallScore: analysis.safetyScore || 0
            }
          });
        });

        this.emit('token:stored', analysis);
      }

      await prisma.$disconnect();
      this.logger.info(`Stored ${analyses.length} token analyses in database`);

    } catch (error) {
      this.logger.error('Failed to store token analyses', {
        error: error instanceof Error ? error.message : 'Unknown error',
        count: analyses.length
      });
    }
  }

  /**
   * Update processed tokens cache
   */
  private updateProcessedTokensCache(tokenAddresses: string[]): void {
    for (const address of tokenAddresses) {
      this.processedTokens.add(address.toLowerCase());
    }

    // Store in persistent cache
    globalCache.set('aggregator:processed-tokens', Array.from(this.processedTokens), 86400); // 24 hours
  }

  /**
   * Load previously processed tokens from cache
   */
  private loadProcessedTokens(): void {
    const cached = globalCache.get<string[]>('aggregator:processed-tokens');
    if (cached) {
      cached.forEach(address => this.processedTokens.add(address));
      this.logger.info(`Loaded ${cached.length} previously processed tokens`);
    }
  }

  /**
   * Update next run time based on cron schedule
   */
  private updateNextRunTime(): void {
    // This is a simplified calculation - in practice would parse cron expression
    const now = new Date();
    this.stats.nextRunAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now
  }

  /**
   * Update aggregation run statistics
   */
  private updateRunStats(run: AggregationRun): void {
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
  private recordRunTime(time: number): void {
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
  addToBlacklist(tokenAddress: string, reason?: string): void {
    const address = tokenAddress.toLowerCase();
    this.blacklistedTokens.add(address);

    this.logger.info(`Token blacklisted: ${address}`, { reason });

    // Store in cache
    globalCache.set('aggregator:blacklisted-tokens', Array.from(this.blacklistedTokens), 86400);

    this.emit('token:blacklisted', { address, reason });
  }

  /**
   * Remove token from blacklist
   */
  removeFromBlacklist(tokenAddress: string): boolean {
    const address = tokenAddress.toLowerCase();
    const removed = this.blacklistedTokens.delete(address);

    if (removed) {
      this.logger.info(`Token removed from blacklist: ${address}`);

      // Update cache
      globalCache.set('aggregator:blacklisted-tokens', Array.from(this.blacklistedTokens), 86400);

      this.emit('token:unblacklisted', { address });
    }

    return removed;
  }

  /**
   * Run manual aggregation (outside of cron schedule)
   */
  async runManualAggregation(): Promise<AggregationRun> {
    this.logger.info('Starting manual aggregation run');
    return await this.runAggregation();
  }

  /**
   * Get aggregation service statistics
   */
  getStats(): AggregatorStats {
    return { ...this.stats };
  }

  /**
   * Get recent run history
   */
  getRunHistory(limit: number = 10): AggregationRun[] {
    return this.runHistory.slice(0, limit);
  }

  /**
   * Get service configuration
   */
  getConfig(): AggregatorConfig {
    return { ...this.config };
  }

  /**
   * Update service configuration
   */
  updateConfig(updates: Partial<AggregatorConfig>): void {
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
  async getHealthStatus(): Promise<{
    aggregator: { healthy: boolean; message: string };
    services: ServiceHealthCheck[];
  }> {
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
  resetStats(): void {
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
    globalCache.delete('aggregator:processed-tokens');

    // Reset pipeline stats
    this.tokenPipeline.resetStats();

    this.logger.info('Aggregator statistics and caches reset');

    this.emit('stats:reset');
  }

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
  } {
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