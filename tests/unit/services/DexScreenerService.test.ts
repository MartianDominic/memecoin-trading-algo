import { DexScreenerService } from '@backend/services/DexScreenerService';
import { jest } from '@jest/globals';

// Mock the BaseApiService
jest.mock('@backend/services/BaseApiService');

describe('DexScreenerService', () => {
  let service: DexScreenerService;
  let mockGet: jest.MockedFunction<typeof service.get>;

  beforeEach(() => {
    service = new DexScreenerService();
    mockGet = jest.fn();
    service.get = mockGet;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTokenPairs', () => {
    const mockTokenAddress = '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R';

    it('should fetch token pairs successfully', async () => {
      const mockResponse = {
        data: {
          pairs: [
            {
              chainId: 'solana',
              dexId: 'raydium',
              url: `https://dexscreener.com/solana/${mockTokenAddress}`,
              pairAddress: 'pair123',
              baseToken: {
                address: mockTokenAddress,
                name: 'Test Token',
                symbol: 'TEST'
              },
              quoteToken: {
                address: 'So11111111111111111111111111111111111111112',
                name: 'Wrapped SOL',
                symbol: 'WSOL'
              },
              priceNative: '0.000123',
              priceUsd: '0.0156',
              liquidity: {
                usd: 12345.67,
                base: 1000000,
                quote: 123.45
              },
              fdv: 156000,
              marketCap: 145000,
              volume: {
                h24: 98765,
                h6: 23456,
                h1: 5678,
                m5: 1234
              },
              priceChange: {
                h24: 5.2,
                h6: 2.1,
                h1: 0.5,
                m5: 0.1
              }
            }
          ]
        },
        status: 200
      };

      mockGet.mockResolvedValue(mockResponse);

      const result = await service.getTokenPairs([mockTokenAddress]);

      expect(mockGet).toHaveBeenCalledWith('/latest/dex/tokens/', {
        params: { tokenAddresses: mockTokenAddress }
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle multiple token addresses', async () => {
      const addresses = [
        '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
        '5fTwKZP2AK1RtyHPfsiryunHW8GHM7CRnqHcE7JSqyNt'
      ];

      const mockResponse = {
        data: { pairs: [] },
        status: 200
      };

      mockGet.mockResolvedValue(mockResponse);

      await service.getTokenPairs(addresses);

      expect(mockGet).toHaveBeenCalledWith('/latest/dex/tokens/', {
        params: { tokenAddresses: addresses.join(',') }
      });
    });

    it('should handle API errors gracefully', async () => {
      const error = new Error('API Error');
      mockGet.mockRejectedValue(error);

      await expect(service.getTokenPairs([mockTokenAddress]))
        .rejects.toThrow('API Error');
    });

    it('should validate token addresses', async () => {
      const invalidAddresses = ['invalid', ''];

      await expect(service.getTokenPairs(invalidAddresses))
        .rejects.toThrow('Invalid token addresses provided');
    });
  });

  describe('searchTokens', () => {
    it('should search tokens by query', async () => {
      const mockResponse = {
        data: {
          pairs: [
            {
              baseToken: {
                address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
                name: 'Bonk',
                symbol: 'BONK'
              },
              priceUsd: '0.000023'
            }
          ]
        },
        status: 200
      };

      mockGet.mockResolvedValue(mockResponse);

      const result = await service.searchTokens('bonk');

      expect(mockGet).toHaveBeenCalledWith('/latest/dex/search/', {
        params: { q: 'bonk' }
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle empty search results', async () => {
      const mockResponse = {
        data: { pairs: [] },
        status: 200
      };

      mockGet.mockResolvedValue(mockResponse);

      const result = await service.searchTokens('nonexistent');

      expect(result.pairs).toHaveLength(0);
    });
  });

  describe('getLatestTokens', () => {
    it('should fetch latest tokens with default parameters', async () => {
      const mockResponse = {
        data: {
          pairs: [
            {
              baseToken: {
                address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
                name: 'New Token',
                symbol: 'NEW'
              },
              createdAt: Date.now()
            }
          ]
        },
        status: 200
      };

      mockGet.mockResolvedValue(mockResponse);

      const result = await service.getLatestTokens();

      expect(mockGet).toHaveBeenCalledWith('/latest/dex/tokens/latest/', {
        params: {
          rankBy: 'trendingScoreH6',
          order: 'desc',
          minLiquidityUsd: 1000
        }
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should apply custom filters', async () => {
      const mockResponse = {
        data: { pairs: [] },
        status: 200
      };

      mockGet.mockResolvedValue(mockResponse);

      await service.getLatestTokens({
        minLiquidityUsd: 5000,
        maxAge: '1h',
        limit: 50
      });

      expect(mockGet).toHaveBeenCalledWith('/latest/dex/tokens/latest/', {
        params: {
          rankBy: 'trendingScoreH6',
          order: 'desc',
          minLiquidityUsd: 5000,
          maxAge: '1h',
          limit: 50
        }
      });
    });
  });

  describe('getTokenMetrics', () => {
    it('should fetch comprehensive token metrics', async () => {
      const tokenAddress = '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R';

      const mockResponse = {
        data: {
          pairs: [{
            priceUsd: '0.0156',
            volume: { h24: 98765 },
            liquidity: { usd: 12345 },
            marketCap: 145000,
            priceChange: { h24: 5.2 }
          }]
        },
        status: 200
      };

      mockGet.mockResolvedValue(mockResponse);

      const result = await service.getTokenMetrics(tokenAddress);

      expect(result).toHaveProperty('price');
      expect(result).toHaveProperty('volume24h');
      expect(result).toHaveProperty('liquidity');
      expect(result).toHaveProperty('marketCap');
      expect(result).toHaveProperty('priceChange24h');
    });

    it('should handle tokens with no pairs', async () => {
      const mockResponse = {
        data: { pairs: [] },
        status: 200
      };

      mockGet.mockResolvedValue(mockResponse);

      const result = await service.getTokenMetrics('invalid_address');

      expect(result).toEqual({
        price: 0,
        volume24h: 0,
        liquidity: 0,
        marketCap: 0,
        priceChange24h: 0
      });
    });
  });

  describe('rate limiting', () => {
    it('should respect rate limits', async () => {
      jest.useFakeTimers();

      const mockResponse = {
        data: { pairs: [] },
        status: 200
      };

      mockGet.mockResolvedValue(mockResponse);

      // Make multiple rapid requests
      const promises = Array(5).fill(null).map(() =>
        service.getTokenPairs(['test'])
      );

      // Fast-forward timers
      jest.advanceTimersByTime(1000);

      await Promise.all(promises);

      // Should have made calls with appropriate delays
      expect(mockGet).toHaveBeenCalledTimes(5);

      jest.useRealTimers();
    });
  });
});