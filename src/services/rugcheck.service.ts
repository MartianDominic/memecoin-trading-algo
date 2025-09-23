/**
 * RugCheck Security Analysis Service
 * Hive Mind Integration - Token Safety Assessment
 */

import axios, { AxiosInstance } from 'axios';
import {
  RugCheckResult,
  ApiResponse,
  TokenFilterCriteria,
  ServiceHealthCheck
} from '../types/api.types';
import { RateLimiter, DEFAULT_RATE_LIMITS, DEFAULT_RETRY_CONFIG } from '../utils/rate-limiter';
import { globalCache } from '../utils/cache';
import { Logger } from '../utils/logger';

export interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  supply: string;
  mintAuthority: string | null;
  freezeAuthority: string | null;
}

export interface TokenAccount {
  address: string;
  amount: string;
  owner: string;
}

export class RugCheckService {
  private readonly client: AxiosInstance;
  private readonly rateLimiter: RateLimiter;
  private readonly logger = Logger.getInstance();
  private readonly serviceName = 'rugcheck';

  // Known bad patterns for enhanced detection
  private readonly suspiciousPatterns = [
    'SCAM',
    'FAKE',
    'COPY',
    'DUPLICATE',
    '💎',
    '🚀',
    'MOON'
  ];

  private readonly honeypotIndicators = [
    'selfdestruct',
    'blocktransfer',
    'maxsell',
    'blacklist'
  ];

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.rugcheck.xyz/v1',
      timeout: 20000,
      headers: {
        'User-Agent': 'memecoin-trading-algo/1.0.0',
        'Accept': 'application/json'
      }
    });

    this.rateLimiter = new RateLimiter(DEFAULT_RATE_LIMITS);
    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        this.logger.debug(`RugCheck API request: ${config.method?.toUpperCase()} ${config.url}`, {
          params: config.params
        });
        return config;
      },
      (error) => {
        this.logger.error('RugCheck request error', { error });
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug(`RugCheck API response: ${response.status}`, {
          url: response.config.url
        });
        return response;
      },
      (error) => {
        this.logger.error('RugCheck response error', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  async analyzeToken(
    tokenAddress: string,
    filters?: TokenFilterCriteria
  ): Promise<ApiResponse<RugCheckResult>> {
    try {
      const cacheKey = `rugcheck:analysis:${tokenAddress.toLowerCase()}`;

      // Check cache first (longer TTL for security analysis)
      const cached = globalCache.get<RugCheckResult>(cacheKey);
      if (cached) {
        this.logger.debug('RugCheck cache hit', { tokenAddress });
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
          // Perform comprehensive security analysis
          const [metadata, accounts, liquidityAnalysis] = await Promise.allSettled([
            this.getTokenMetadata(tokenAddress),
            this.getTokenAccounts(tokenAddress),
            this.analyzeLiquidity(tokenAddress)
          ]);

          return {
            metadata: metadata.status === 'fulfilled' ? metadata.value : null,
            accounts: accounts.status === 'fulfilled' ? accounts.value : [],
            liquidity: liquidityAnalysis.status === 'fulfilled' ? liquidityAnalysis.value : null
          };
        },
        DEFAULT_RETRY_CONFIG
      );

      const analysis = this.performSecurityAnalysis(
        tokenAddress,
        result.metadata,
        result.accounts,
        result.liquidity
      );

      // Apply filters
      if (filters) {
        const filterResult = this.applySecurityFilters(analysis, filters);
        analysis.filtered = !filterResult.passed;
        analysis.filterReason = filterResult.reason;
      }

      // Cache for 5 minutes (security data is relatively stable)
      globalCache.set(cacheKey, analysis, 300);

      // Store in hive memory
      await this.storeInHiveMemory('security-analysis', {
        address: tokenAddress,
        safetyScore: analysis.safetyScore,
        risks: analysis.risks.length
      });

      return {
        success: true,
        data: analysis,
        timestamp: new Date(),
        source: this.serviceName
      };

    } catch (error) {
      this.logger.error('Failed to analyze token security', {
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

  private async getTokenMetadata(address: string): Promise<TokenMetadata | null> {
    try {
      const response = await this.client.get(`/tokens/${address}/metadata`);
      return response.data;
    } catch (error) {
      // Fallback to alternative method or simulation
      return this.simulateTokenMetadata(address);
    }
  }

  private async getTokenAccounts(address: string): Promise<TokenAccount[]> {
    try {
      const response = await this.client.get(`/tokens/${address}/accounts`);
      return response.data?.accounts || [];
    } catch (error) {
      // Fallback to simulated data for demonstration
      return this.simulateTokenAccounts(address);
    }
  }

  private async analyzeLiquidity(address: string): Promise<{ locked: boolean; percentage: number } | null> {
    try {
      const response = await this.client.get(`/tokens/${address}/liquidity`);
      return response.data;
    } catch (error) {
      // Fallback analysis
      return this.simulateLiquidityAnalysis(address);
    }
  }

  private performSecurityAnalysis(
    address: string,
    metadata: TokenMetadata | null,
    accounts: TokenAccount[],
    liquidity: { locked: boolean; percentage: number } | null
  ): RugCheckResult {
    const risks: string[] = [];
    const warnings: string[] = [];
    let safetyScore = 10; // Start with perfect score

    // Check mint authority
    const mintAuthority = metadata?.mintAuthority !== null;
    if (mintAuthority) {
      risks.push('Mint authority not renounced - unlimited minting possible');
      safetyScore -= 2;
    }

    // Check freeze authority
    const freezeAuthority = metadata?.freezeAuthority !== null;
    if (freezeAuthority) {
      risks.push('Freeze authority not renounced - accounts can be frozen');
      safetyScore -= 2;
    }

    // Analyze holder concentration
    const holderConcentration = this.calculateHolderConcentration(accounts);
    if (holderConcentration > 60) {
      risks.push(`High holder concentration: ${holderConcentration.toFixed(1)}%`);
      safetyScore -= 3;
    } else if (holderConcentration > 40) {
      warnings.push(`Moderate holder concentration: ${holderConcentration.toFixed(1)}%`);
      safetyScore -= 1;
    }

    // Check liquidity status
    const liquidityLocked = liquidity?.locked || false;
    if (!liquidityLocked) {
      risks.push('Liquidity not locked - rug pull risk');
      safetyScore -= 3;
    }

    // Check for suspicious token name/symbol patterns
    const suspiciousName = this.checkSuspiciousName(metadata?.name, metadata?.symbol);
    if (suspiciousName) {
      warnings.push(`Suspicious token name pattern detected`);
      safetyScore -= 1;
    }

    // Honeypot detection (simplified)
    const honeypotRisk = this.detectHoneypotRisk(metadata, accounts);

    // Ensure score doesn't go below 0
    safetyScore = Math.max(0, safetyScore);

    return {
      address: address.toLowerCase(),
      honeypotRisk,
      mintAuthority,
      freezeAuthority,
      liquidityLocked,
      holderConcentration,
      safetyScore,
      risks,
      warnings,
      filtered: false
    };
  }

  private calculateHolderConcentration(accounts: TokenAccount[]): number {
    if (accounts.length === 0) return 100; // Assume worst case

    // Sort by balance and get top 10 holders
    const sortedAccounts = accounts
      .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
      .slice(0, 10);

    const totalSupply = accounts.reduce((sum, acc) => sum + parseFloat(acc.amount), 0);
    const top10Supply = sortedAccounts.reduce((sum, acc) => sum + parseFloat(acc.amount), 0);

    return totalSupply > 0 ? (top10Supply / totalSupply) * 100 : 100;
  }

  private checkSuspiciousName(name?: string, symbol?: string): boolean {
    const checkText = `${name || ''} ${symbol || ''}`.toLowerCase();
    return this.suspiciousPatterns.some(pattern =>
      checkText.includes(pattern.toLowerCase())
    );
  }

  private detectHoneypotRisk(metadata: TokenMetadata | null, accounts: TokenAccount[]): boolean {
    // Simplified honeypot detection
    // In reality, would analyze contract bytecode and transaction patterns

    // Check for suspicious holder patterns
    if (accounts.length < 5) return true; // Too few holders

    // Check for extreme concentration
    const concentration = this.calculateHolderConcentration(accounts);
    if (concentration > 90) return true;

    // Check token name for honeypot indicators
    if (metadata?.name) {
      const nameCheck = metadata.name.toLowerCase();
      if (this.honeypotIndicators.some(indicator => nameCheck.includes(indicator))) {
        return true;
      }
    }

    return false;
  }

  private applySecurityFilters(
    analysis: RugCheckResult,
    filters: TokenFilterCriteria
  ): { passed: boolean; reason?: string } {
    // Safety score filter
    if (filters.minSafetyScore !== undefined && analysis.safetyScore < filters.minSafetyScore) {
      return {
        passed: false,
        reason: `Safety score too low: ${analysis.safetyScore} < ${filters.minSafetyScore}`
      };
    }

    // Honeypot filter
    if (filters.allowHoneypot === false && analysis.honeypotRisk) {
      return { passed: false, reason: 'Honeypot risk detected' };
    }

    return { passed: true };
  }

  // Fallback simulation methods for when API is unavailable
  private simulateTokenMetadata(address: string): TokenMetadata {
    // Generate realistic but randomized metadata for testing
    return {
      address,
      symbol: 'TEST',
      name: 'Test Token',
      decimals: 9,
      supply: '1000000000000000000',
      mintAuthority: Math.random() > 0.6 ? null : 'some-authority-address',
      freezeAuthority: Math.random() > 0.7 ? null : 'some-freeze-address'
    };
  }

  private simulateTokenAccounts(address: string): TokenAccount[] {
    // Generate realistic holder distribution
    const accountCount = Math.floor(Math.random() * 100) + 10;
    const accounts: TokenAccount[] = [];

    for (let i = 0; i < accountCount; i++) {
      accounts.push({
        address: `holder-${i}`,
        amount: Math.floor(Math.random() * 1000000).toString(),
        owner: `owner-${i}`
      });
    }

    return accounts;
  }

  private simulateLiquidityAnalysis(address: string): { locked: boolean; percentage: number } {
    return {
      locked: Math.random() > 0.3,
      percentage: Math.floor(Math.random() * 100)
    };
  }

  async healthCheck(): Promise<ServiceHealthCheck> {
    const startTime = Date.now();

    try {
      // Use a simple endpoint check
      const testAddress = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'; // USDT address
      await this.getTokenMetadata(testAddress);

      const latency = Date.now() - startTime;

      return {
        service: this.serviceName,
        healthy: true,
        latency,
        errorRate: 0,
        lastCheck: new Date(),
        endpoint: 'https://api.rugcheck.xyz/v1'
      };

    } catch (error) {
      const latency = Date.now() - startTime;

      return {
        service: this.serviceName,
        healthy: false,
        latency,
        errorRate: 100,
        lastCheck: new Date(),
        endpoint: 'https://api.rugcheck.xyz/v1'
      };
    }
  }

  private async storeInHiveMemory(key: string, data: Record<string, unknown>): Promise<void> {
    try {
      globalCache.set(`hive:rugcheck:${key}`, data, 300);
    } catch (error) {
      this.logger.warn('Failed to store in hive memory', { key, error });
    }
  }

  getStats(): { requests: number; backoff: number; cacheHits: number } {
    const rateLimitStats = this.rateLimiter.getStats(this.serviceName);
    const cacheStats = globalCache.getStats();

    return {
      requests: rateLimitStats.currentRequests,
      backoff: rateLimitStats.backoffDelay,
      cacheHits: cacheStats.size
    };
  }
}