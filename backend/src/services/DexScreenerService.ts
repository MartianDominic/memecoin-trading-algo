// DexScreener API service implementation
import { BaseApiService, ApiServiceConfig } from './BaseApiService';
import { DexScreenerToken, TokenData, PriceInfo } from '../types';
import { logger } from '../config/logger';

export class DexScreenerService extends BaseApiService {
  constructor(config: ApiServiceConfig) {
    super(config, 'dexscreener');
  }

  /**
   * Search for tokens by query (symbol, name, or address)
   */
  async searchTokens(query: string): Promise<DexScreenerToken[]> {
    try {
      const response = await this.get<{ pairs: DexScreenerToken[] }>(`/dex/search?q=${encodeURIComponent(query)}`);
      return response.pairs || [];
    } catch (error) {
      logger.error('Failed to search tokens on DexScreener:', error);
      throw error;
    }
  }

  /**
   * Get token pairs by token address
   */
  async getTokenPairs(tokenAddress: string): Promise<DexScreenerToken[]> {
    try {
      const response = await this.get<{ pairs: DexScreenerToken[] }>(`/dex/tokens/${tokenAddress}`);
      return response.pairs || [];
    } catch (error) {
      logger.error(`Failed to get token pairs for ${tokenAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get specific pair information by pair address
   */
  async getPairInfo(pairAddress: string): Promise<DexScreenerToken | null> {
    try {
      const response = await this.get<{ pair: DexScreenerToken }>(`/dex/pairs/${pairAddress}`);
      return response.pair || null;
    } catch (error) {
      logger.error(`Failed to get pair info for ${pairAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get multiple pairs information
   */
  async getMultiplePairs(pairAddresses: string[]): Promise<DexScreenerToken[]> {
    try {
      const addressList = pairAddresses.join(',');
      const response = await this.get<{ pairs: DexScreenerToken[] }>(`/dex/pairs/${addressList}`);
      return response.pairs || [];
    } catch (error) {
      logger.error('Failed to get multiple pairs info:', error);
      throw error;
    }
  }

  /**
   * Get latest tokens (newly created pairs)
   */
  async getLatestTokens(chainId?: string): Promise<DexScreenerToken[]> {
    try {
      const url = chainId ? `/dex/tokens/latest/${chainId}` : '/dex/tokens/latest';
      const response = await this.get<{ pairs: DexScreenerToken[] }>(url);
      return response.pairs || [];
    } catch (error) {
      logger.error('Failed to get latest tokens:', error);
      throw error;
    }
  }

  /**
   * Get trending tokens
   */
  async getTrendingTokens(chainId?: string): Promise<DexScreenerToken[]> {
    try {
      const url = chainId ? `/dex/tokens/trending/${chainId}` : '/dex/tokens/trending';
      const response = await this.get<{ pairs: DexScreenerToken[] }>(url);
      return response.pairs || [];
    } catch (error) {
      logger.error('Failed to get trending tokens:', error);
      throw error;
    }
  }

  /**
   * Convert DexScreener token to standardized TokenData format
   */
  convertToTokenData(dexToken: DexScreenerToken): TokenData {
    return {
      address: dexToken.baseToken.address,
      symbol: dexToken.baseToken.symbol,
      name: dexToken.baseToken.name,
      decimals: 9, // Default for Solana, would need to be fetched separately
      chain: this.mapChainId(dexToken.chainId),
      marketCap: dexToken.liquidity?.usd ? dexToken.liquidity.usd * 2 : undefined, // Rough estimate
    };
  }

  /**
   * Convert DexScreener token to standardized PriceInfo format
   */
  convertToPriceInfo(dexToken: DexScreenerToken): PriceInfo {
    return {
      price: parseFloat(dexToken.priceUsd),
      priceChange1h: dexToken.priceChange.h1,
      priceChange24h: dexToken.priceChange.h24,
      volume24h: dexToken.volume.h24,
      liquidity: dexToken.liquidity?.usd,
      timestamp: new Date(),
      source: 'dexscreener',
    };
  }

  /**
   * Map DexScreener chain ID to standard chain name
   */
  private mapChainId(chainId: string): string {
    const chainMap: Record<string, string> = {
      'solana': 'solana',
      'ethereum': 'ethereum',
      'bsc': 'binance-smart-chain',
      'polygon': 'polygon',
      'arbitrum': 'arbitrum',
      'optimism': 'optimism',
      'avalanche': 'avalanche',
      'fantom': 'fantom',
    };

    return chainMap[chainId.toLowerCase()] || chainId;
  }

  /**
   * Filter tokens by volume and liquidity thresholds
   */
  filterByThresholds(
    tokens: DexScreenerToken[],
    minVolume24h: number = 10000,
    minLiquidity: number = 5000
  ): DexScreenerToken[] {
    return tokens.filter(token => {
      const volume24h = token.volume.h24 || 0;
      const liquidity = token.liquidity?.usd || 0;

      return volume24h >= minVolume24h && liquidity >= minLiquidity;
    });
  }

  /**
   * Sort tokens by various criteria
   */
  sortTokens(
    tokens: DexScreenerToken[],
    sortBy: 'volume' | 'liquidity' | 'priceChange24h' | 'age' = 'volume',
    ascending: boolean = false
  ): DexScreenerToken[] {
    const sorted = [...tokens].sort((a, b) => {
      let valueA: number;
      let valueB: number;

      switch (sortBy) {
        case 'volume':
          valueA = a.volume.h24 || 0;
          valueB = b.volume.h24 || 0;
          break;
        case 'liquidity':
          valueA = a.liquidity?.usd || 0;
          valueB = b.liquidity?.usd || 0;
          break;
        case 'priceChange24h':
          valueA = a.priceChange.h24 || 0;
          valueB = b.priceChange.h24 || 0;
          break;
        case 'age':
          // Assuming newer pairs appear first in API response
          valueA = tokens.indexOf(a);
          valueB = tokens.indexOf(b);
          break;
        default:
          return 0;
      }

      return ascending ? valueA - valueB : valueB - valueA;
    });

    return sorted;
  }

  /**
   * Get comprehensive token analysis
   */
  async getTokenAnalysis(tokenAddress: string): Promise<{
    tokenData: TokenData;
    priceInfo: PriceInfo;
    pairs: DexScreenerToken[];
    bestPair: DexScreenerToken | null;
  }> {
    try {
      const pairs = await this.getTokenPairs(tokenAddress);

      if (pairs.length === 0) {
        throw new Error(`No pairs found for token ${tokenAddress}`);
      }

      // Find the best pair (highest liquidity)
      const bestPair = pairs.reduce((best, current) => {
        const bestLiquidity = best.liquidity?.usd || 0;
        const currentLiquidity = current.liquidity?.usd || 0;
        return currentLiquidity > bestLiquidity ? current : best;
      });

      return {
        tokenData: this.convertToTokenData(bestPair),
        priceInfo: this.convertToPriceInfo(bestPair),
        pairs,
        bestPair,
      };
    } catch (error) {
      logger.error(`Failed to get token analysis for ${tokenAddress}:`, error);
      throw error;
    }
  }
}