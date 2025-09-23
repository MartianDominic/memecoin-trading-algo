const { TokenAggregator } = require('../../src/services/token-aggregator');
const { APIResponseMocks } = require('../../../tests/mocks/api-responses');

describe('TokenAggregator', () => {
  let aggregator;
  let apiMocks;
  let mockFetch;

  beforeEach(() => {
    apiMocks = new APIResponseMocks();
    const { mockFetch: fetch } = apiMocks.setupFetchMocks();
    mockFetch = fetch;
    global.fetch = mockFetch;

    aggregator = new TokenAggregator({
      rateLimit: {
        requests: 100,
        window: 60000
      },
      timeout: 30000
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    global.fetch.mockRestore?.();
  });

  describe('fetchFromAllSources', () => {
    it('should aggregate data from all API sources', async () => {
      const result = await aggregator.fetchFromAllSources();

      expect(result).toHaveProperty('dexscreener');
      expect(result).toHaveProperty('jupiter');
      expect(result).toHaveProperty('coingecko');
      expect(result).toHaveProperty('solscan');

      expect(Array.isArray(result.dexscreener)).toBe(true);
      expect(Array.isArray(result.jupiter)).toBe(true);
      expect(Array.isArray(result.coingecko)).toBe(true);
      expect(Array.isArray(result.solscan)).toBe(true);

      // Verify fetch was called for each service
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('should handle individual service failures gracefully', async () => {
      // Mock one service to fail
      mockFetch.mockImplementationOnce((url) => {
        if (url.includes('dexscreener')) {
          return Promise.reject(new Error('Network error'));
        }
        return apiMocks.setupFetchMocks().mockFetch(url);
      });

      const result = await aggregator.fetchFromAllSources();

      expect(result.dexscreener).toEqual([]);
      expect(Array.isArray(result.jupiter)).toBe(true);
      expect(Array.isArray(result.coingecko)).toBe(true);
      expect(Array.isArray(result.solscan)).toBe(true);
    });

    it('should respect rate limiting', async () => {
      const fastAggregator = new TokenAggregator({
        rateLimit: {
          requests: 2,
          window: 1000
        }
      });

      // Make multiple rapid requests
      const promises = Array(5).fill(null).map(() =>
        fastAggregator.fetchFromAllSources()
      );

      const results = await Promise.allSettled(promises);

      // Some requests should be rejected due to rate limiting
      const rejected = results.filter(r => r.status === 'rejected');
      expect(rejected.length).toBeGreaterThan(0);
    });

    it('should cache responses to reduce API calls', async () => {
      // First call
      await aggregator.fetchFromAllSources();
      const firstCallCount = mockFetch.mock.calls.length;

      // Second call within cache window
      await aggregator.fetchFromAllSources();
      const secondCallCount = mockFetch.mock.calls.length;

      // Should use cached data, no additional API calls
      expect(secondCallCount).toBe(firstCallCount);
    });
  });

  describe('mergeTokenData', () => {
    it('should merge token data from multiple sources correctly', async () => {
      const mockData = {
        dexscreener: [
          {
            pairAddress: 'token1',
            baseToken: { symbol: 'TEST1', name: 'Test Token 1' },
            priceUsd: '1.50',
            volume: { h24: 10000 },
            liquidity: { usd: 50000 }
          }
        ],
        jupiter: [
          {
            address: 'token1',
            symbol: 'TEST1',
            verified: true,
            daily_volume: 12000
          }
        ],
        coingecko: [
          {
            platforms: { solana: 'token1' },
            market_data: {
              current_price: { usd: 1.52 },
              market_cap: { usd: 1000000 }
            }
          }
        ],
        solscan: [
          {
            tokenAddress: 'token1',
            holder: 5000,
            createdTime: 1640995200
          }
        ]
      };

      const merged = aggregator.mergeTokenData(mockData);

      expect(merged).toHaveLength(1);
      expect(merged[0]).toEqual(expect.objectContaining({
        address: 'token1',
        symbol: 'TEST1',
        name: 'Test Token 1',
        price: expect.any(Number),
        volume24h: expect.any(Number),
        liquidity: expect.any(Number),
        marketCap: expect.any(Number),
        holders: 5000,
        verified: true,
        sources: expect.arrayContaining(['dexscreener', 'jupiter', 'coingecko', 'solscan'])
      }));
    });

    it('should handle missing data gracefully', async () => {
      const incompleteData = {
        dexscreener: [
          {
            pairAddress: 'token2',
            baseToken: { symbol: 'TEST2' },
            priceUsd: '0.50'
          }
        ],
        jupiter: [],
        coingecko: [],
        solscan: []
      };

      const merged = aggregator.mergeTokenData(incompleteData);

      expect(merged).toHaveLength(1);
      expect(merged[0]).toEqual(expect.objectContaining({
        address: 'token2',
        symbol: 'TEST2',
        price: 0.50,
        sources: ['dexscreener']
      }));
    });

    it('should prioritize data sources correctly', async () => {
      const conflictingData = {
        dexscreener: [
          {
            pairAddress: 'token3',
            baseToken: { symbol: 'TEST3' },
            priceUsd: '1.00',
            volume: { h24: 5000 }
          }
        ],
        jupiter: [
          {
            address: 'token3',
            symbol: 'TEST3',
            daily_volume: 7000,
            verified: true
          }
        ],
        coingecko: [
          {
            platforms: { solana: 'token3' },
            market_data: {
              current_price: { usd: 1.05 },
              total_volume: { usd: 6000 }
            }
          }
        ],
        solscan: []
      };

      const merged = aggregator.mergeTokenData(conflictingData);

      expect(merged[0]).toEqual(expect.objectContaining({
        price: 1.05, // CoinGecko takes priority for price
        volume24h: 7000, // Jupiter takes priority for volume
        verified: true
      }));
    });
  });

  describe('applyFilters', () => {
    let sampleTokens;

    beforeEach(() => {
      sampleTokens = [
        {
          address: 'token1',
          symbol: 'MEME1',
          price: 0.001,
          volume24h: 100000,
          marketCap: 50000,
          liquidity: 25000,
          holders: 1000,
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
          priceChange24h: 150,
          tags: ['meme']
        },
        {
          address: 'token2',
          symbol: 'STABLE',
          price: 1.00,
          volume24h: 50000,
          marketCap: 1000000,
          liquidity: 500000,
          holders: 5000,
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          priceChange24h: 2,
          tags: ['defi']
        },
        {
          address: 'token3',
          symbol: 'PUMP',
          price: 0.01,
          volume24h: 200000,
          marketCap: 100000,
          liquidity: 75000,
          holders: 2000,
          createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
          priceChange24h: 500,
          tags: ['meme']
        }
      ];
    });

    it('should filter by volume range', () => {
      const filters = {
        volume24h: { min: 75000, max: 150000 }
      };

      const filtered = aggregator.applyFilters(sampleTokens, filters);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].symbol).toBe('MEME1');
    });

    it('should filter by market cap range', () => {
      const filters = {
        marketCap: { min: 60000, max: 200000 }
      };

      const filtered = aggregator.applyFilters(sampleTokens, filters);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].symbol).toBe('PUMP');
    });

    it('should filter by age (hours since creation)', () => {
      const filters = {
        age: { max: 12 } // Less than 12 hours old
      };

      const filtered = aggregator.applyFilters(sampleTokens, filters);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].symbol).toBe('PUMP');
    });

    it('should filter by price change percentage', () => {
      const filters = {
        priceChange24h: { min: 100 } // More than 100% gain
      };

      const filtered = aggregator.applyFilters(sampleTokens, filters);
      expect(filtered).toHaveLength(2);
      expect(filtered.map(t => t.symbol)).toEqual(expect.arrayContaining(['MEME1', 'PUMP']));
    });

    it('should filter by tags', () => {
      const filters = {
        tags: ['meme']
      };

      const filtered = aggregator.applyFilters(sampleTokens, filters);
      expect(filtered).toHaveLength(2);
      expect(filtered.every(t => t.tags.includes('meme'))).toBe(true);
    });

    it('should filter by holder count', () => {
      const filters = {
        holders: { min: 1500 }
      };

      const filtered = aggregator.applyFilters(sampleTokens, filters);
      expect(filtered).toHaveLength(2);
      expect(filtered.map(t => t.symbol)).toEqual(expect.arrayContaining(['STABLE', 'PUMP']));
    });

    it('should apply multiple filters simultaneously', () => {
      const filters = {
        volume24h: { min: 75000 },
        priceChange24h: { min: 50 },
        tags: ['meme']
      };

      const filtered = aggregator.applyFilters(sampleTokens, filters);
      expect(filtered).toHaveLength(2);
      expect(filtered.every(t =>
        t.volume24h >= 75000 &&
        t.priceChange24h >= 50 &&
        t.tags.includes('meme')
      )).toBe(true);
    });

    it('should return empty array when no tokens match filters', () => {
      const filters = {
        marketCap: { min: 10000000 } // Very high market cap
      };

      const filtered = aggregator.applyFilters(sampleTokens, filters);
      expect(filtered).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle network timeouts', async () => {
      mockFetch.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const result = await aggregator.fetchFromAllSources();

      expect(result.dexscreener).toEqual([]);
      expect(result.jupiter).toEqual([]);
      expect(result.coingecko).toEqual([]);
      expect(result.solscan).toEqual([]);
    });

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.reject(new Error('Invalid JSON'))
        })
      );

      const result = await aggregator.fetchFromAllSources();

      expect(result.dexscreener).toEqual([]);
      expect(result.jupiter).toEqual([]);
      expect(result.coingecko).toEqual([]);
      expect(result.solscan).toEqual([]);
    });

    it('should handle HTTP error status codes', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Server error' })
        })
      );

      const result = await aggregator.fetchFromAllSources();

      expect(result.dexscreener).toEqual([]);
      expect(result.jupiter).toEqual([]);
      expect(result.coingecko).toEqual([]);
      expect(result.solscan).toEqual([]);
    });
  });

  describe('performance', () => {
    it('should complete aggregation within acceptable time limit', async () => {
      const startTime = Date.now();
      await aggregator.fetchFromAllSources();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle large datasets efficiently', async () => {
      const largeMockData = apiMocks.generatePerformanceData(1000);

      const startTime = Date.now();
      const merged = aggregator.mergeTokenData({
        dexscreener: largeMockData.responses.dexscreener.pairs,
        jupiter: largeMockData.responses.jupiter,
        coingecko: largeMockData.responses.coingecko.coins,
        solscan: largeMockData.responses.solscan
      });
      const duration = Date.now() - startTime;

      expect(merged.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000); // Should merge 1000 tokens within 1 second
    });
  });
});