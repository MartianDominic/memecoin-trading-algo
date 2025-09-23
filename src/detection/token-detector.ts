/**
 * Token Detection Engine - Core detection logic and algorithms
 */

import { BlockchainService } from '../services/blockchain.service';
import { TokenData, TokenMetrics, TokenSecurity, DetectionResult, PipelineConfig, TokenAlert } from '../types/token.types';
import { Logger } from '../utils/logger';
import { CacheManager } from '../utils/cache-manager';
import { EventEmitter } from 'events';

export class TokenDetector extends EventEmitter {
  private readonly logger = Logger.getInstance();
  private readonly cache = CacheManager.getInstance();
  private readonly processedTokens = new Set<string>();
  private isRunning = false;

  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly config: PipelineConfig
  ) {
    super();
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Token detector is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting token detection pipeline', { config: this.config });

    // Start detection loops for each network
    for (const network of this.config.networks) {
      this.startDetectionLoop(network);
    }

    this.emit('started');
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    this.logger.info('Stopping token detection pipeline');
    this.emit('stopped');
  }

  private async startDetectionLoop(network: string): Promise<void> {
    while (this.isRunning) {
      try {
        await this.detectNewTokens(network);
        await this.sleep(this.config.refreshInterval);
      } catch (error) {
        this.logger.error('Error in detection loop', { network, error });
        await this.sleep(5000); // Wait 5 seconds on error
      }
    }
  }

  private async detectNewTokens(network: string): Promise<void> {
    this.logger.debug('Scanning for new tokens', { network });

    const newTokenAddresses = await this.blockchainService.getNewTokens(network, 50);
    const unprocessedTokens = newTokenAddresses.filter(address => !this.processedTokens.has(address));

    if (unprocessedTokens.length === 0) {
      this.logger.debug('No new tokens found', { network });
      return;
    }

    this.logger.info(`Found ${unprocessedTokens.length} new tokens`, { network });

    // Process tokens in batches
    const batchSize = 5;
    for (let i = 0; i < unprocessedTokens.length; i += batchSize) {
      const batch = unprocessedTokens.slice(i, i + batchSize);
      await this.processBatch(batch, network);
    }
  }

  private async processBatch(addresses: string[], network: string): Promise<void> {
    const promises = addresses.map(address => this.analyzeToken(address, network));
    const results = await Promise.allSettled(promises);

    results.forEach((result, index) => {
      const address = addresses[index];
      this.processedTokens.add(address);

      if (result.status === 'fulfilled' && result.value) {
        this.handleDetectionResult(result.value);
      } else {
        this.logger.warn('Failed to analyze token', {
          address,
          error: result.status === 'rejected' ? result.reason : 'Unknown error'
        });
      }
    });
  }

  public async analyzeToken(address: string, network: string): Promise<DetectionResult | null> {
    try {
      // Check cache first
      const cacheKey = `analysis:${network}:${address}`;
      const cachedResult = await this.cache.get<DetectionResult>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      this.logger.debug('Analyzing token', { address, network });

      // Fetch token data in parallel
      const [tokenData, metrics, security] = await Promise.all([
        this.blockchainService.getTokenData(address, network),
        this.blockchainService.getTokenMetrics(address, network),
        this.blockchainService.getTokenSecurity(address, network)
      ]);

      if (!tokenData || !metrics || !security) {
        this.logger.warn('Incomplete token data', { address, network });
        return null;
      }

      // Calculate detection score
      const score = this.calculateDetectionScore(tokenData, metrics, security);

      // Generate recommendations and alerts
      const recommendations = this.generateRecommendations(tokenData, metrics, security, score);
      const alerts = await this.generateAlerts(tokenData, metrics, security);

      const result: DetectionResult = {
        token: tokenData,
        metrics,
        security,
        score,
        recommendations,
        alerts
      };

      // Cache the result
      await this.cache.set(cacheKey, result, 300); // 5 minutes cache

      return result;
    } catch (error) {
      this.logger.error('Error analyzing token', { address, network, error });
      return null;
    }
  }

  private calculateDetectionScore(
    token: TokenData,
    metrics: TokenMetrics,
    security: TokenSecurity
  ): number {
    let score = 0;

    // Liquidity score (0-30 points)
    if (metrics.liquidity > 100000) score += 30;
    else if (metrics.liquidity > 50000) score += 20;
    else if (metrics.liquidity > 10000) score += 10;

    // Volume score (0-25 points)
    if (metrics.volume24h > 500000) score += 25;
    else if (metrics.volume24h > 100000) score += 20;
    else if (metrics.volume24h > 50000) score += 15;
    else if (metrics.volume24h > 10000) score += 10;

    // Security score (0-25 points)
    if (security.contractVerified) score += 8;
    if (security.liquidityLocked) score += 8;
    if (security.ownershipRenounced) score += 9;

    // Risk penalty
    if (security.overallRisk === 'high') score -= 20;
    else if (security.overallRisk === 'medium') score -= 10;

    // Price action score (0-20 points)
    if (metrics.priceChange24h > 50) score += 20;
    else if (metrics.priceChange24h > 20) score += 15;
    else if (metrics.priceChange24h > 10) score += 10;
    else if (metrics.priceChange24h > 5) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  private generateRecommendations(
    token: TokenData,
    metrics: TokenMetrics,
    security: TokenSecurity,
    score: number
  ): string[] {
    const recommendations: string[] = [];

    if (score >= 80) {
      recommendations.push('🟢 High-quality token with strong fundamentals');
    } else if (score >= 60) {
      recommendations.push('🟡 Moderate potential, monitor closely');
    } else if (score >= 40) {
      recommendations.push('🟠 High risk, proceed with caution');
    } else {
      recommendations.push('🔴 Very high risk, avoid investment');
    }

    if (metrics.liquidity < 10000) {
      recommendations.push('⚠️ Low liquidity - high slippage risk');
    }

    if (!security.contractVerified) {
      recommendations.push('⚠️ Unverified contract - additional security risk');
    }

    if (security.buyTax > 10 || security.sellTax > 10) {
      recommendations.push('⚠️ High transaction taxes detected');
    }

    if (security.honeypotRisk === 'high') {
      recommendations.push('🚨 High honeypot risk detected');
    }

    if (metrics.priceChange24h > 100) {
      recommendations.push('📈 Extreme price movement - potential pump and dump');
    }

    return recommendations;
  }

  private async generateAlerts(
    token: TokenData,
    metrics: TokenMetrics,
    security: TokenSecurity
  ): Promise<TokenAlert[]> {
    const alerts: TokenAlert[] = [];

    // New token alert
    const tokenAge = Date.now() - token.createdAt.getTime();
    if (tokenAge < 24 * 60 * 60 * 1000) { // Less than 24 hours old
      alerts.push({
        id: `new_token_${token.address}_${Date.now()}`,
        tokenAddress: token.address,
        alertType: 'new_token',
        severity: 'medium',
        message: `New token detected: ${token.symbol} (${token.name})`,
        data: { tokenAge, createdAt: token.createdAt },
        timestamp: new Date(),
        acknowledged: false
      });
    }

    // Price spike alert
    if (metrics.priceChange24h > this.config.alertThresholds.priceChangePercent) {
      alerts.push({
        id: `price_spike_${token.address}_${Date.now()}`,
        tokenAddress: token.address,
        alertType: 'price_spike',
        severity: metrics.priceChange24h > 100 ? 'high' : 'medium',
        message: `Price spike: ${metrics.priceChange24h.toFixed(2)}% in 24h`,
        data: { priceChange: metrics.priceChange24h, currentPrice: metrics.price },
        timestamp: new Date(),
        acknowledged: false
      });
    }

    // Volume spike alert
    if (metrics.volume24h > this.config.alertThresholds.volumeChangePercent * metrics.marketCap) {
      alerts.push({
        id: `volume_spike_${token.address}_${Date.now()}`,
        tokenAddress: token.address,
        alertType: 'volume_spike',
        severity: 'medium',
        message: `High volume detected: $${metrics.volume24h.toLocaleString()}`,
        data: { volume24h: metrics.volume24h, marketCap: metrics.marketCap },
        timestamp: new Date(),
        acknowledged: false
      });
    }

    // Security risk alert
    if (security.overallRisk === 'high') {
      alerts.push({
        id: `security_risk_${token.address}_${Date.now()}`,
        tokenAddress: token.address,
        alertType: 'security_risk',
        severity: 'high',
        message: `High security risk detected for ${token.symbol}`,
        data: {
          honeypotRisk: security.honeypotRisk,
          rugPullRisk: security.rugPullRisk,
          contractVerified: security.contractVerified
        },
        timestamp: new Date(),
        acknowledged: false
      });
    }

    return alerts;
  }

  private handleDetectionResult(result: DetectionResult): void {
    this.logger.info('Token analysis complete', {
      address: result.token.address,
      symbol: result.token.symbol,
      score: result.score,
      alertCount: result.alerts.length
    });

    // Emit events for real-time monitoring
    this.emit('tokenDetected', result);

    // Emit alerts
    result.alerts.forEach(alert => {
      this.emit('alert', alert);
    });

    // Log high-score tokens
    if (result.score >= 70) {
      this.emit('highScoreToken', result);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getProcessedTokensCount(): number {
    return this.processedTokens.size;
  }

  public clearProcessedTokens(): void {
    this.processedTokens.clear();
  }
}