/**
 * Blockchain Service - Multi-chain token data fetching
 */

import axios, { AxiosInstance } from 'axios';
import { TokenData, TokenMetrics, TokenSecurity } from '../types/tokens';
import { Logger } from '../utils/logger';

export interface BlockchainAPIConfig {
  etherscan: string;
  bscscan: string;
  polygonscan: string;
  dexscreener: string;
  moralis: string;
  coingecko: string;
}

export class BlockchainService {
  private readonly apiClients: Map<string, AxiosInstance> = new Map();
  private readonly logger = Logger.getInstance();
  private readonly rateLimit = new Map<string, number>();

  constructor(private readonly apiKeys: BlockchainAPIConfig) {
    this.initializeClients();
  }

  private initializeClients(): void {
    // Etherscan API
    this.apiClients.set('etherscan', axios.create({
      baseURL: 'https://api.etherscan.io/api',
      timeout: 10000,
      params: { apikey: this.apiKeys.etherscan }
    }));

    // BSCScan API
    this.apiClients.set('bscscan', axios.create({
      baseURL: 'https://api.bscscan.com/api',
      timeout: 10000,
      params: { apikey: this.apiKeys.bscscan }
    }));

    // DexScreener API
    this.apiClients.set('dexscreener', axios.create({
      baseURL: 'https://api.dexscreener.com/latest/dex',
      timeout: 10000
    }));

    // Moralis API
    this.apiClients.set('moralis', axios.create({
      baseURL: 'https://deep-index.moralis.io/api/v2',
      timeout: 15000,
      headers: { 'X-API-Key': this.apiKeys.moralis }
    }));
  }

  private async checkRateLimit(service: string): Promise<void> {
    const now = Date.now();
    const lastCall = this.rateLimit.get(service) || 0;
    const minInterval = service === 'dexscreener' ? 1000 : 200; // Different rate limits

    if (now - lastCall < minInterval) {
      await new Promise(resolve => setTimeout(resolve, minInterval - (now - lastCall)));
    }
    this.rateLimit.set(service, Date.now());
  }

  public async getTokenData(address: string, network: string = 'ethereum'): Promise<TokenData | null> {
    try {
      await this.checkRateLimit('moralis');

      const client = this.apiClients.get('moralis');
      if (!client) throw new Error('Moralis client not initialized');

      const response = await client.get(`/erc20/metadata`, {
        params: {
          chain: network,
          addresses: [address]
        }
      });

      const tokenInfo = response.data[0];
      if (!tokenInfo) return null;

      return {
        address: tokenInfo.address.toLowerCase(),
        symbol: tokenInfo.symbol,
        name: tokenInfo.name,
        decimals: tokenInfo.decimals,
        totalSupply: tokenInfo.total_supply || '0',
        network,
        createdAt: new Date(tokenInfo.created_at || Date.now()),
        lastUpdated: new Date()
      };
    } catch (error) {
      this.logger.error('Failed to fetch token data', { address, network, error });
      return null;
    }
  }

  public async getTokenMetrics(address: string, network: string = 'ethereum'): Promise<TokenMetrics | null> {
    try {
      await this.checkRateLimit('dexscreener');

      const client = this.apiClients.get('dexscreener');
      if (!client) throw new Error('DexScreener client not initialized');

      const response = await client.get(`/tokens/${address}`);
      const pairs = response.data.pairs;

      if (!pairs || pairs.length === 0) return null;

      // Get the most liquid pair
      interface DexPair {
        liquidity?: { usd: number };
        priceUsd?: string;
        priceChange?: { h24?: string };
        volume?: { h24?: string };
        baseToken: { address: string };
        chainId?: string;
      }
      const topPair = (pairs as DexPair[]).sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];

      return {
        address: address.toLowerCase(),
        price: parseFloat(topPair.priceUsd || '0'),
        priceChange24h: parseFloat(topPair.priceChange?.h24 || '0'),
        volume24h: parseFloat(topPair.volume?.h24 || '0'),
        marketCap: parseFloat(topPair.marketCap || '0'),
        liquidity: parseFloat(topPair.liquidity?.usd || '0'),
        holderCount: 0, // Would need additional API call
        transactionCount24h: parseFloat(topPair.txns?.h24?.buys || '0') + parseFloat(topPair.txns?.h24?.sells || '0'),
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('Failed to fetch token metrics', { address, network, error });
      return null;
    }
  }

  public async getTokenSecurity(address: string, network: string = 'ethereum'): Promise<TokenSecurity> {
    try {
      // This would integrate with security analysis APIs like GoPlus Security
      // For now, providing a basic structure
      const defaultSecurity: TokenSecurity = {
        address: address.toLowerCase(),
        contractVerified: false,
        liquidityLocked: false,
        ownershipRenounced: false,
        maxTransactionLimit: 0,
        maxWalletLimit: 0,
        buyTax: 0,
        sellTax: 0,
        honeypotRisk: 'medium',
        rugPullRisk: 'medium',
        overallRisk: 'medium'
      };

      // Check contract verification
      if (network === 'ethereum' || network === 'bsc') {
        const scannerClient = this.apiClients.get(network === 'ethereum' ? 'etherscan' : 'bscscan');
        if (scannerClient) {
          await this.checkRateLimit(network === 'ethereum' ? 'etherscan' : 'bscscan');

          const verificationResponse = await scannerClient.get('', {
            params: {
              module: 'contract',
              action: 'getsourcecode',
              address
            }
          });

          if (verificationResponse.data.status === '1' && verificationResponse.data.result[0].SourceCode) {
            defaultSecurity.contractVerified = true;
          }
        }
      }

      return defaultSecurity;
    } catch (error) {
      this.logger.error('Failed to fetch token security', { address, network, error });
      return {
        address: address.toLowerCase(),
        contractVerified: false,
        liquidityLocked: false,
        ownershipRenounced: false,
        maxTransactionLimit: 0,
        maxWalletLimit: 0,
        buyTax: 0,
        sellTax: 0,
        honeypotRisk: 'high',
        rugPullRisk: 'high',
        overallRisk: 'high'
      };
    }
  }

  public async getNewTokens(network: string = 'ethereum', limit: number = 100): Promise<string[]> {
    try {
      await this.checkRateLimit('dexscreener');

      const client = this.apiClients.get('dexscreener');
      if (!client) throw new Error('DexScreener client not initialized');

      const response = await client.get(`/tokens/trending`);
      const tokens = response.data.pairs || [];

      interface TrendingPair {
        chainId?: string;
        baseToken: { address: string };
      }
      return (tokens as TrendingPair[])
        .filter((pair) => pair.chainId === network)
        .slice(0, limit)
        .map((pair) => pair.baseToken.address.toLowerCase());
    } catch (error) {
      this.logger.error('Failed to fetch new tokens', { network, error });
      return [];
    }
  }

  public async batchGetTokenData(addresses: string[], network: string = 'ethereum'): Promise<TokenData[]> {
    const batchSize = 10;
    const results: TokenData[] = [];

    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      const batchPromises = batch.map(address => this.getTokenData(address, network));

      const batchResults = await Promise.allSettled(batchPromises);
      const validResults = batchResults
        .filter((result): result is PromiseFulfilledResult<TokenData> =>
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value);

      results.push(...validResults);

      // Rate limiting between batches
      if (i + batchSize < addresses.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}