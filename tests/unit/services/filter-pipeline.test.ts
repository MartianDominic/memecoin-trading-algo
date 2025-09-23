import { FilterPipeline } from '@backend/services/FilterPipeline';
import { jest } from '@jest/globals';

interface MockToken {
  address: string;
  symbol: string;
  name: string;
  price: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  priceChange24h: number;
  age: number; // hours
  holderCount?: number;
  riskScore?: number;
}

describe('FilterPipeline', () => {
  let filterPipeline: FilterPipeline;

  beforeEach(() => {
    filterPipeline = new FilterPipeline();
  });

  const createMockToken = (overrides: Partial<MockToken> = {}): MockToken => ({
    address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    symbol: 'TEST',
    name: 'Test Token',
    price: 0.0156,
    volume24h: 98765,
    marketCap: 145000,
    liquidity: 12345,
    priceChange24h: 5.2,
    age: 2,
    holderCount: 1500,
    riskScore: 25,
    ...overrides
  });

  describe('Basic Filters', () => {
    describe('Minimum Liquidity Filter', () => {
      it('should filter out tokens with low liquidity', () => {
        const tokens = [
          createMockToken({ liquidity: 15000 }), // Pass
          createMockToken({ liquidity: 5000 }),  // Fail
          createMockToken({ liquidity: 20000 })  // Pass
        ];

        const result = filterPipeline.applyFilter(tokens, {
          type: 'minLiquidity',
          value: 10000
        });

        expect(result).toHaveLength(2);
        expect(result[0].liquidity).toBeGreaterThanOrEqual(10000);
        expect(result[1].liquidity).toBeGreaterThanOrEqual(10000);
      });

      it('should handle edge cases for minimum liquidity', () => {
        const tokens = [
          createMockToken({ liquidity: 10000 }), // Exactly at threshold
          createMockToken({ liquidity: 9999 }),  // Just below
          createMockToken({ liquidity: 0 })      // Zero liquidity
        ];

        const result = filterPipeline.applyFilter(tokens, {
          type: 'minLiquidity',
          value: 10000
        });

        expect(result).toHaveLength(1);
        expect(result[0].liquidity).toBe(10000);
      });
    });

    describe('Volume Filter', () => {
      it('should filter tokens by 24h volume', () => {
        const tokens = [
          createMockToken({ volume24h: 150000 }), // Pass
          createMockToken({ volume24h: 50000 }),  // Fail
          createMockToken({ volume24h: 200000 })  // Pass
        ];

        const result = filterPipeline.applyFilter(tokens, {
          type: 'minVolume24h',
          value: 100000
        });

        expect(result).toHaveLength(2);
        expect(result.every(token => token.volume24h >= 100000)).toBe(true);
      });

      it('should handle volume range filters', () => {
        const tokens = [
          createMockToken({ volume24h: 50000 }),  // Below range
          createMockToken({ volume24h: 150000 }), // In range
          createMockToken({ volume24h: 250000 }), // In range
          createMockToken({ volume24h: 350000 })  // Above range
        ];

        const result = filterPipeline.applyFilter(tokens, {
          type: 'volumeRange',
          minValue: 100000,
          maxValue: 300000
        });

        expect(result).toHaveLength(2);
        expect(result.every(token =>
          token.volume24h >= 100000 && token.volume24h <= 300000
        )).toBe(true);
      });
    });

    describe('Market Cap Filter', () => {
      it('should filter by market cap range', () => {
        const tokens = [
          createMockToken({ marketCap: 50000 }),   // Below
          createMockToken({ marketCap: 150000 }),  // In range
          createMockToken({ marketCap: 500000 }),  // In range
          createMockToken({ marketCap: 1500000 })  // Above
        ];

        const result = filterPipeline.applyFilter(tokens, {
          type: 'marketCapRange',
          minValue: 100000,
          maxValue: 1000000
        });

        expect(result).toHaveLength(2);
        expect(result.every(token =>
          token.marketCap >= 100000 && token.marketCap <= 1000000
        )).toBe(true);
      });
    });

    describe('Age Filter', () => {
      it('should filter tokens by age', () => {
        const tokens = [
          createMockToken({ age: 0.5 }),  // 30 minutes - too new
          createMockToken({ age: 2 }),    // 2 hours - good
          createMockToken({ age: 24 }),   // 24 hours - good
          createMockToken({ age: 100 })   // 100 hours - too old
        ];

        const result = filterPipeline.applyFilter(tokens, {
          type: 'ageRange',
          minHours: 1,
          maxHours: 48
        });

        expect(result).toHaveLength(2);
        expect(result.every(token =>
          token.age >= 1 && token.age <= 48
        )).toBe(true);
      });
    });
  });

  describe('Advanced Filters', () => {
    describe('Risk Score Filter', () => {
      it('should filter out high-risk tokens', () => {
        const tokens = [
          createMockToken({ riskScore: 15 }),  // Low risk
          createMockToken({ riskScore: 45 }),  // Medium risk
          createMockToken({ riskScore: 85 })   // High risk
        ];

        const result = filterPipeline.applyFilter(tokens, {
          type: 'maxRiskScore',
          value: 50
        });

        expect(result).toHaveLength(2);
        expect(result.every(token => (token.riskScore || 0) <= 50)).toBe(true);
      });
    });

    describe('Holder Count Filter', () => {
      it('should filter by minimum holder count', () => {
        const tokens = [
          createMockToken({ holderCount: 500 }),   // Too few
          createMockToken({ holderCount: 1500 }),  // Good
          createMockToken({ holderCount: 5000 })   // Good
        ];

        const result = filterPipeline.applyFilter(tokens, {
          type: 'minHolders',
          value: 1000
        });

        expect(result).toHaveLength(2);
        expect(result.every(token => (token.holderCount || 0) >= 1000)).toBe(true);
      });
    });

    describe('Price Change Filter', () => {
      it('should filter by price change thresholds', () => {
        const tokens = [
          createMockToken({ priceChange24h: -10 }), // Falling
          createMockToken({ priceChange24h: 5 }),   // Moderate gain
          createMockToken({ priceChange24h: 50 }),  // High gain
          createMockToken({ priceChange24h: 200 })  // Extreme gain
        ];

        const result = filterPipeline.applyFilter(tokens, {
          type: 'priceChangeRange',
          minPercent: 0,
          maxPercent: 100
        });

        expect(result).toHaveLength(2);
        expect(result.every(token =>
          token.priceChange24h >= 0 && token.priceChange24h <= 100
        )).toBe(true);
      });
    });
  });

  describe('Custom Filters', () => {
    it('should support custom filter functions', () => {
      const tokens = [
        createMockToken({ symbol: 'DOGE' }),
        createMockToken({ symbol: 'SHIB' }),
        createMockToken({ symbol: 'BTC' }),
        createMockToken({ symbol: 'ETH' })
      ];

      // Custom filter for meme coins
      const customFilter = (token: MockToken) =>
        ['DOGE', 'SHIB'].includes(token.symbol);

      const result = filterPipeline.applyCustomFilter(tokens, customFilter);

      expect(result).toHaveLength(2);
      expect(result.map(t => t.symbol)).toEqual(['DOGE', 'SHIB']);
    });

    it('should support complex custom filters', () => {
      const tokens = [
        createMockToken({
          volume24h: 200000,
          marketCap: 500000,
          priceChange24h: 15
        }),
        createMockToken({
          volume24h: 50000,
          marketCap: 200000,
          priceChange24h: 25
        }),
        createMockToken({
          volume24h: 300000,
          marketCap: 100000,
          priceChange24h: 5
        })
      ];

      // Custom filter: High volume AND (good market cap OR high price change)
      const complexFilter = (token: MockToken) =>
        token.volume24h > 100000 &&
        (token.marketCap > 400000 || token.priceChange24h > 20);

      const result = filterPipeline.applyCustomFilter(tokens, complexFilter);

      expect(result).toHaveLength(1);
      expect(result[0].volume24h).toBe(200000);
    });
  });

  describe('Pipeline Chaining', () => {
    it('should chain multiple filters', () => {
      const tokens = [
        createMockToken({
          liquidity: 15000,
          volume24h: 150000,
          riskScore: 30
        }),
        createMockToken({
          liquidity: 5000,   // Will be filtered out
          volume24h: 200000,
          riskScore: 20
        }),
        createMockToken({
          liquidity: 20000,
          volume24h: 50000,  // Will be filtered out
          riskScore: 25
        }),
        createMockToken({
          liquidity: 25000,
          volume24h: 180000,
          riskScore: 60      // Will be filtered out
        })
      ];

      const filters = [
        { type: 'minLiquidity', value: 10000 },
        { type: 'minVolume24h', value: 100000 },
        { type: 'maxRiskScore', value: 50 }
      ];

      const result = filterPipeline.applyFilterChain(tokens, filters);

      expect(result).toHaveLength(1);
      expect(result[0].liquidity).toBeGreaterThanOrEqual(10000);
      expect(result[0].volume24h).toBeGreaterThanOrEqual(100000);
      expect(result[0].riskScore).toBeLessThanOrEqual(50);
    });

    it('should maintain filter order in chain', () => {
      const tokens = Array.from({ length: 1000 }, (_, i) =>
        createMockToken({
          liquidity: Math.random() * 50000,
          volume24h: Math.random() * 500000,
          riskScore: Math.random() * 100
        })
      );

      const filters = [
        { type: 'minLiquidity', value: 20000 },
        { type: 'minVolume24h', value: 200000 },
        { type: 'maxRiskScore', value: 40 }
      ];

      const result = filterPipeline.applyFilterChain(tokens, filters);

      // Verify all filters are applied
      expect(result.every(token =>
        token.liquidity >= 20000 &&
        token.volume24h >= 200000 &&
        (token.riskScore || 0) <= 40
      )).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    it('should filter large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) =>
        createMockToken({
          address: `token_${i}`,
          liquidity: Math.random() * 100000,
          volume24h: Math.random() * 1000000
        })
      );

      const startTime = Date.now();

      const result = filterPipeline.applyFilterChain(largeDataset, [
        { type: 'minLiquidity', value: 50000 },
        { type: 'minVolume24h', value: 500000 }
      ]);

      const processingTime = Date.now() - startTime;

      // Should process 10k tokens in under 100ms
      expect(processingTime).toBeLessThan(100);
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThan(largeDataset.length);
    });

    it('should handle empty datasets gracefully', () => {
      const result = filterPipeline.applyFilterChain([], [
        { type: 'minLiquidity', value: 10000 }
      ]);

      expect(result).toEqual([]);
    });

    it('should handle invalid filter parameters', () => {
      const tokens = [createMockToken()];

      expect(() => {
        filterPipeline.applyFilter(tokens, {
          type: 'minLiquidity',
          value: -1000 // Invalid negative value
        });
      }).toThrow('Invalid filter parameter');

      expect(() => {
        filterPipeline.applyFilter(tokens, {
          type: 'unknownFilter',
          value: 1000
        } as never);
      }).toThrow('Unknown filter type');
    });
  });

  describe('Filter Statistics', () => {
    it('should provide filtering statistics', () => {
      const tokens = Array.from({ length: 100 }, (_, i) =>
        createMockToken({
          liquidity: i * 1000 // 0 to 99000
        })
      );

      const result = filterPipeline.applyFilterWithStats(tokens, {
        type: 'minLiquidity',
        value: 50000
      });

      expect(result.filtered.length).toBe(50); // 50k to 99k
      expect(result.stats.originalCount).toBe(100);
      expect(result.stats.filteredCount).toBe(50);
      expect(result.stats.rejectedCount).toBe(50);
      expect(result.stats.rejectionRate).toBeCloseTo(0.5);
    });

    it('should provide detailed rejection reasons', () => {
      const tokens = [
        createMockToken({ liquidity: 5000, volume24h: 50000 }),
        createMockToken({ liquidity: 15000, volume24h: 50000 }),
        createMockToken({ liquidity: 15000, volume24h: 150000 })
      ];

      const filters = [
        { type: 'minLiquidity', value: 10000 },
        { type: 'minVolume24h', value: 100000 }
      ];

      const result = filterPipeline.applyFilterChainWithStats(tokens, filters);

      expect(result.filtered).toHaveLength(1);
      expect(result.stats.rejectionReasons).toHaveProperty('minLiquidity');
      expect(result.stats.rejectionReasons).toHaveProperty('minVolume24h');
      expect(result.stats.rejectionReasons.minLiquidity).toBe(1);
      expect(result.stats.rejectionReasons.minVolume24h).toBe(1);
    });
  });
});