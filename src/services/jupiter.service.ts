/**
 * Jupiter Aggregator Service
 * Hive Mind Integration - DEX Routing and Slippage Analysis
 */

import axios, { AxiosInstance } from 'axios';
import {
  JupiterQuoteResponse,
  JupiterTokenData,
  ApiResponse,
  TokenFilterCriteria,
  ServiceHealthCheck
} from '../types/api.types';
import { RateLimiter, DEFAULT_RATE_LIMITS, DEFAULT_RETRY_CONFIG } from '../utils/rate-limiter';
import { globalCache } from '../utils/cache';
import { Logger } from '../utils/logger';

export interface JupiterToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  tags: string[];
}

export interface JupiterRoute {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  marketInfos: Array<{
    id: string;
    label: string;
    inputMint: string;
    outputMint: string;
    notEnoughLiquidity: boolean;
    inAmount: string;
    outAmount: string;
    priceImpactPct: number;
    lpFee: {
      amount: string;
      mint: string;
      pct: number;
    };
    platformFee: {
      amount: string;
      mint: string;
      pct: number;
    };
  }>;
}

export class JupiterService {
  private readonly client: AxiosInstance;
  private readonly rateLimiter: RateLimiter;
  private readonly logger = Logger.getInstance();
  private readonly serviceName = 'jupiter';

  // Standard test amounts for slippage analysis
  private readonly testAmounts = [100, 500, 1000, 5000]; // USD values
  private readonly usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  private readonly solMint = 'So11111111111111111111111111111111111111112';

  // Known blacklisted tokens
  private readonly blacklistedTokens = new Set<string>();

  constructor() {
    this.client = axios.create({
      baseURL: 'https://quote-api.jup.ag/v6',
      timeout: 15000,
      headers: {
        'User-Agent': 'memecoin-trading-algo/1.0.0',
        'Accept': 'application/json'
      }
    });

    this.rateLimiter = new RateLimiter(DEFAULT_RATE_LIMITS);
    this.setupInterceptors();
    this.loadBlacklist();
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        this.logger.debug(`Jupiter API request: ${config.method?.toUpperCase()} ${config.url}`, {
          params: config.params
        });
        return config;
      },
      (error) => {
        this.logger.error('Jupiter request error', { error });
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug(`Jupiter API response: ${response.status}`, {
          url: response.config.url
        });
        return response;
      },
      (error) => {
        this.logger.error('Jupiter response error', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  private async loadBlacklist(): Promise<void> {
    try {
      // Load Jupiter's token blacklist
      const response = await this.client.get('/tokens');
      const tokens: JupiterToken[] = response.data;

      tokens.forEach(token => {
        if (token.tags.includes('blacklisted') || token.tags.includes('community-blacklisted')) {
          this.blacklistedTokens.add(token.address.toLowerCase());
        }
      });

      this.logger.info(`Loaded ${this.blacklistedTokens.size} blacklisted tokens`);
    } catch (error) {
      this.logger.warn('Failed to load Jupiter blacklist', { error });
    }
  }

  async analyzeToken(
    tokenAddress: string,
    filters?: TokenFilterCriteria
  ): Promise<ApiResponse<JupiterTokenData>> {
    try {
      const cacheKey = `jupiter:analysis:${tokenAddress.toLowerCase()}`;

      // Check cache first
      const cached = globalCache.get<JupiterTokenData>(cacheKey);
      if (cached) {
        this.logger.debug('Jupiter cache hit', { tokenAddress });
        return {
          success: true,
          data: cached,
          timestamp: new Date(),
          source: this.serviceName
        };
      }

      const result = await this.rateLimiter.executeWithBackoff(
        this.serviceName,
        async () => {
          // Perform multiple analyses in parallel
          const [routingAnalysis, slippageAnalysis, volumeAnalysis] = await Promise.allSettled([
            this.checkRouting(tokenAddress),
            this.analyzeSlippage(tokenAddress),
            this.analyzeVolume(tokenAddress)
          ]);

          return {
            routing: routingAnalysis.status === 'fulfilled' ? routingAnalysis.value : null,
            slippage: slippageAnalysis.status === 'fulfilled' ? slippageAnalysis.value : null,
            volume: volumeAnalysis.status === 'fulfilled' ? volumeAnalysis.value : null
          };
        },
        DEFAULT_RETRY_CONFIG
      );

      const analysis = this.buildTokenAnalysis(tokenAddress, result);

      // Apply filters
      if (filters) {
        const filterResult = this.applyRoutingFilters(analysis, filters);
        analysis.filtered = !filterResult.passed;
        analysis.filterReason = filterResult.reason;
      }

      // Cache for 2 minutes (routing can change frequently)
      globalCache.set(cacheKey, analysis, 120);

      // Store in hive memory
      await this.storeInHiveMemory('routing-analysis', {
        address: tokenAddress,
        routingAvailable: analysis.routingAvailable,
        slippage: analysis.slippageEstimate
      });

      return {
        success: true,
        data: analysis,
        timestamp: new Date(),
        source: this.serviceName
      };

    } catch (error) {
      this.logger.error('Failed to analyze Jupiter routing', {
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

  private async checkRouting(tokenAddress: string): Promise<{
    available: boolean;
    routeCount: number;
    bestRoute?: JupiterRoute;
  }> {
    try {
      // Test routing from USDC to target token
      const amount = 500 * 1000000; // $500 in USDC (6 decimals)

      const response = await this.client.get<JupiterQuoteResponse>('/quote', {
        params: {
          inputMint: this.usdcMint,
          outputMint: tokenAddress,
          amount: amount.toString(),
          slippageBps: 300, // 3% slippage tolerance
          onlyDirectRoutes: false,
          asLegacyTransaction: false
        }
      });

      return {
        available: true,
        routeCount: response.data.routePlan?.length || 0,
        bestRoute: response.data as unknown as JupiterRoute
      };

    } catch (error) {
      // No routing available
      return {
        available: false,
        routeCount: 0
      };
    }
  }

  private async analyzeSlippage(tokenAddress: string): Promise<{
    estimates: Array<{ amount: number; slippage: number }>;
    averageSlippage: number;
  }> {
    const estimates: Array<{ amount: number; slippage: number }> = [];

    for (const testAmount of this.testAmounts) {
      try {
        const amountInUsdc = testAmount * 1000000; // Convert to USDC units

        const response = await this.client.get<JupiterQuoteResponse>('/quote', {
          params: {
            inputMint: this.usdcMint,
            outputMint: tokenAddress,
            amount: amountInUsdc.toString(),
            slippageBps: 1000, // 10% max slippage for testing
            onlyDirectRoutes: false
          }
        });

        const priceImpact = parseFloat(response.data.priceImpactPct || '0');
        estimates.push({
          amount: testAmount,
          slippage: Math.abs(priceImpact)
        });

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        // If we can't get a quote for this amount, record high slippage
        estimates.push({
          amount: testAmount,
          slippage: 50 // 50% as penalty for unavailable routing
        });
      }
    }

    const averageSlippage = estimates.reduce((sum, est) => sum + est.slippage, 0) / estimates.length;

    return { estimates, averageSlippage };
  }

  private async analyzeVolume(tokenAddress: string): Promise<{ volume24h: number; spread: number }> {
    try {
      // Get volume data by checking both directions of a trade
      const [buyQuote, sellQuote] = await Promise.allSettled([
        this.getQuote(this.usdcMint, tokenAddress, 1000 * 1000000), // Buy with $1000
        this.getQuote(tokenAddress, this.usdcMint, 1000000000) // Sell some tokens
      ]);

      // Calculate spread between buy and sell prices
      let spread = 0;
      if (buyQuote.status === 'fulfilled' && sellQuote.status === 'fulfilled') {
        const buyPrice = parseFloat(buyQuote.value.priceImpactPct || '0');
        const sellPrice = parseFloat(sellQuote.value.priceImpactPct || '0');
        spread = Math.abs(buyPrice - sellPrice);
      }

      // Volume estimation (simplified - would need more sophisticated analysis)
      const estimatedVolume = spread < 5 ? 100000 : spread < 10 ? 50000 : 10000;

      return {
        volume24h: estimatedVolume,
        spread
      };

    } catch (error) {
      return {
        volume24h: 0,
        spread: 100 // High spread indicates poor liquidity
      };
    }
  }

  private async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number
  ): Promise<JupiterQuoteResponse> {
    const response = await this.client.get<JupiterQuoteResponse>('/quote', {
      params: {
        inputMint,
        outputMint,
        amount: amount.toString(),
        slippageBps: 500 // 5% slippage
      }
    });

    return response.data;
  }

  private buildTokenAnalysis(
    tokenAddress: string,
    data: {
      routing: { available: boolean; routeCount: number; bestRoute?: JupiterRoute } | null;
      slippage: { estimates: Array<{ amount: number; slippage: number }>; averageSlippage: number } | null;
      volume: { volume24h: number; spread: number } | null;
    }
  ): JupiterTokenData {
    const blacklisted = this.blacklistedTokens.has(tokenAddress.toLowerCase());

    return {
      address: tokenAddress.toLowerCase(),
      routingAvailable: data.routing?.available || false,
      slippageEstimate: data.slippage?.averageSlippage || 100,
      spread: data.volume?.spread || 100,
      volume24h: data.volume?.volume24h || 0,
      blacklisted,
      routeCount: data.routing?.routeCount || 0,
      filtered: false
    };
  }

  private applyRoutingFilters(
    analysis: JupiterTokenData,
    filters: TokenFilterCriteria
  ): { passed: boolean; reason?: string } {
    // Routing requirement
    if (filters.requireRouting === true && !analysis.routingAvailable) {
      return { passed: false, reason: 'No routing available through Jupiter' };
    }

    // Slippage filter
    if (filters.maxSlippage !== undefined && analysis.slippageEstimate > filters.maxSlippage) {
      return {
        passed: false,
        reason: `Slippage too high: ${analysis.slippageEstimate.toFixed(2)}% > ${filters.maxSlippage}%`
      };
    }

    // Blacklist filter
    if (filters.allowBlacklisted === false && analysis.blacklisted) {
      return { passed: false, reason: 'Token is blacklisted on Jupiter' };
    }

    return { passed: true };
  }

  async getTokenList(): Promise<ApiResponse<JupiterToken[]>> {
    try {
      const cacheKey = 'jupiter:tokenlist';

      const cached = globalCache.get<JupiterToken[]>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          timestamp: new Date(),
          source: this.serviceName
        };
      }

      const result = await this.rateLimiter.executeWithBackoff(
        this.serviceName,
        async () => {
          const response = await this.client.get<JupiterToken[]>('/tokens');
          return response.data;
        },
        DEFAULT_RETRY_CONFIG
      );

      // Cache token list for 1 hour
      globalCache.set(cacheKey, result, 3600);

      return {
        success: true,
        data: result,
        timestamp: new Date(),
        source: this.serviceName
      };

    } catch (error) {
      this.logger.error('Failed to fetch Jupiter token list', {
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

  async healthCheck(): Promise<ServiceHealthCheck> {
    const startTime = Date.now();

    try {
      // Test with a simple USDC->SOL quote
      await this.getQuote(this.usdcMint, this.solMint, 1000000); // $1 worth

      const latency = Date.now() - startTime;

      return {
        service: this.serviceName,
        healthy: true,
        latency,
        errorRate: 0,
        lastCheck: new Date(),
        endpoint: 'https://quote-api.jup.ag/v6'
      };

    } catch (error) {
      const latency = Date.now() - startTime;

      return {
        service: this.serviceName,
        healthy: false,
        latency,
        errorRate: 100,
        lastCheck: new Date(),
        endpoint: 'https://quote-api.jup.ag/v6'
      };
    }
  }

  private async storeInHiveMemory(key: string, data: Record<string, unknown>): Promise<void> {
    try {
      globalCache.set(`hive:jupiter:${key}`, data, 300);
    } catch (error) {
      this.logger.warn('Failed to store in hive memory', { key, error });
    }
  }

  getStats(): { requests: number; backoff: number; cacheHits: number; blacklistedTokens: number } {
    const rateLimitStats = this.rateLimiter.getStats(this.serviceName);
    const cacheStats = globalCache.getStats();

    return {
      requests: rateLimitStats.currentRequests,
      backoff: rateLimitStats.backoffDelay,
      cacheHits: cacheStats.size,
      blacklistedTokens: this.blacklistedTokens.size
    };
  }
}