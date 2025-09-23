/**
 * API Services Index - Unified Export
 * Hive Mind Integration - Complete API Service Layer
 */

// Core Services
export { DexScreenerService } from './dexscreener.service';
export { RugCheckService } from './rugcheck.service';
export { JupiterService } from './jupiter.service';
export { SolscanService } from './solscan.service';

// Aggregation Services
export { TokenPipelineService, type PipelineConfig, type PipelineStats } from './token-pipeline.service';
export { TokenAggregatorService, type AggregatorConfig, type AggregatorStats } from './token-aggregator.service';

// Health and Monitoring
export { HealthCheckService, healthCheckService, type ApiService, type SystemHealthReport } from './health-check.service';

// Blockchain Service (existing)
export { BlockchainService, type BlockchainAPIConfig } from './blockchain.service';

// Combined Service Manager for Easy Integration
import { DexScreenerService } from './dexscreener.service';
import { RugCheckService } from './rugcheck.service';
import { JupiterService } from './jupiter.service';
import { SolscanService } from './solscan.service';
import { healthCheckService } from './health-check.service';
import { Logger } from '../utils/logger';
import {
  CombinedTokenAnalysis,
  TokenFilterCriteria,
  ApiResponse,
  DexScreenerTokenData,
  RugCheckResult,
  JupiterTokenData,
  SolscanTokenData
} from '../types/api.types';

export class TokenAnalysisService {
  private readonly logger = Logger.getInstance();
  private readonly dexScreener: DexScreenerService;
  private readonly rugCheck: RugCheckService;
  private readonly jupiter: JupiterService;
  private readonly solscan: SolscanService;

  constructor() {
    this.dexScreener = new DexScreenerService();
    this.rugCheck = new RugCheckService();
    this.jupiter = new JupiterService();
    this.solscan = new SolscanService();

    this.logger.info('TokenAnalysisService initialized with all API services');
  }

  /**
   * Perform comprehensive token analysis using all services
   */
  async analyzeToken(
    tokenAddress: string,
    filters?: TokenFilterCriteria
  ): Promise<ApiResponse<CombinedTokenAnalysis>> {
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
      const analysis = this.buildCombinedAnalysis(
        tokenAddress,
        dexData,
        rugData,
        jupiterData,
        solscanData,
        filters
      );

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

    } catch (error) {
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

  private buildCombinedAnalysis(
    tokenAddress: string,
    dexData: DexScreenerTokenData | null,
    rugData: RugCheckResult | null,
    jupiterData: JupiterTokenData | null,
    solscanData: SolscanTokenData | null,
    filters?: TokenFilterCriteria
  ): CombinedTokenAnalysis {
    const failedFilters: string[] = [];
    let totalScore = 0;
    let scoreComponents = 0;

    // DEXScreener scoring (25 points max)
    if (dexData && !dexData.filtered) {
      totalScore += 25;
      scoreComponents++;
    } else if (dexData?.filterReason) {
      failedFilters.push(`DEX: ${dexData.filterReason}`);
    }

    // RugCheck scoring (30 points max)
    if (rugData && !rugData.filtered) {
      const rugScore = (rugData.safetyScore / 10) * 30;
      totalScore += rugScore;
      scoreComponents++;
    } else if (rugData?.filterReason) {
      failedFilters.push(`Security: ${rugData.filterReason}`);
    }

    // Jupiter scoring (25 points max)
    if (jupiterData && !jupiterData.filtered) {
      let jupiterScore = 25;
      if (jupiterData.slippageEstimate > 10) jupiterScore -= 10;
      if (jupiterData.blacklisted) jupiterScore -= 15;
      totalScore += Math.max(0, jupiterScore);
      scoreComponents++;
    } else if (jupiterData?.filterReason) {
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
    } else if (solscanData?.filterReason) {
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

  private getDefaultDexData(address: string): DexScreenerTokenData {
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

  private getDefaultRugData(address: string): RugCheckResult {
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

  private getDefaultJupiterData(address: string): JupiterTokenData {
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

  private getDefaultSolscanData(address: string): SolscanTokenData {
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
      fundingPattern: 'suspicious' as const,
      filtered: true,
      filterReason: 'Data unavailable'
    };
  }

  /**
   * Get health status of all services
   */
  async getSystemHealth() {
    return await healthCheckService.checkAllServices();
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
      system: await healthCheckService.getServiceStats()
    };
  }
}

// Export singleton instance
export const tokenAnalysisService = new TokenAnalysisService();