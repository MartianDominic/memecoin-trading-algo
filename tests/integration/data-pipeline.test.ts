import { PrismaClient } from '@prisma/client';
import { DexScreenerService } from '@backend/services/DexScreenerService';
import { TokenAggregatorService } from '@backend/services/TokenAggregatorService';
import { SafetyAnalysisService } from '@backend/services/SafetyAnalysisService';
import { jest } from '@jest/globals';

describe('Data Pipeline Integration', () => {
  let prisma: PrismaClient;
  let dexScreenerService: DexScreenerService;
  let aggregatorService: TokenAggregatorService;
  let safetyService: SafetyAnalysisService;

  const testTokenAddress = '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R';

  beforeAll(async () => {
    prisma = global.__PRISMA__;
    dexScreenerService = new DexScreenerService();
    aggregatorService = new TokenAggregatorService();
    safetyService = new SafetyAnalysisService();
  });

  beforeEach(async () => {
    // Clean test data
    await prisma.token.deleteMany();
    await prisma.tokenMetrics.deleteMany();
    await prisma.safetyAnalysis.deleteMany();
  });

  describe('End-to-End Token Processing', () => {
    it('should process token from discovery to storage', async () => {
      // Step 1: Mock token discovery from DexScreener
      const mockTokenData = {
        pairs: [{
          baseToken: {
            address: testTokenAddress,
            name: 'Test Token',
            symbol: 'TEST'
          },
          quoteToken: {
            address: 'So11111111111111111111111111111111111111112',
            name: 'Wrapped SOL',
            symbol: 'WSOL'
          },
          priceUsd: '0.0156',
          volume: { h24: 98765 },
          liquidity: { usd: 12345 },
          marketCap: 145000,
          priceChange: { h24: 5.2 },
          createdAt: Date.now()
        }]
      };

      jest.spyOn(dexScreenerService, 'getLatestTokens')
        .mockResolvedValue(mockTokenData);

      // Step 2: Process through aggregator
      const aggregatedData = await aggregatorService.processNewTokens();

      expect(aggregatedData).toHaveLength(1);
      expect(aggregatedData[0]).toMatchObject({
        address: testTokenAddress,
        symbol: 'TEST',
        name: 'Test Token'
      });

      // Step 3: Verify token stored in database
      const storedToken = await prisma.token.findUnique({
        where: { address: testTokenAddress },
        include: {
          metrics: true,
          safetyAnalysis: true
        }
      });

      expect(storedToken).not.toBeNull();
      expect(storedToken?.symbol).toBe('TEST');
      expect(storedToken?.metrics).toHaveLength(1);

      // Step 4: Verify metrics calculated correctly
      const metrics = storedToken?.metrics[0];
      expect(metrics?.price).toBeCloseTo(0.0156);
      expect(metrics?.volume24h).toBe(98765);
      expect(metrics?.marketCap).toBe(145000);

      // Step 5: Verify safety analysis performed
      expect(storedToken?.safetyAnalysis).toHaveLength(1);
      const safety = storedToken?.safetyAnalysis[0];
      expect(safety?.riskScore).toBeGreaterThanOrEqual(0);
      expect(safety?.riskScore).toBeLessThanOrEqual(100);
    });

    it('should handle duplicate token processing', async () => {
      // First processing
      const mockTokenData = {
        pairs: [{
          baseToken: {
            address: testTokenAddress,
            name: 'Test Token',
            symbol: 'TEST'
          },
          priceUsd: '0.0156'
        }]
      };

      jest.spyOn(dexScreenerService, 'getLatestTokens')
        .mockResolvedValue(mockTokenData);

      await aggregatorService.processNewTokens();

      // Second processing with updated data
      const updatedTokenData = {
        pairs: [{
          baseToken: {
            address: testTokenAddress,
            name: 'Test Token',
            symbol: 'TEST'
          },
          priceUsd: '0.0200'
        }]
      };

      jest.spyOn(dexScreenerService, 'getLatestTokens')
        .mockResolvedValue(updatedTokenData);

      await aggregatorService.processNewTokens();

      // Should have only one token with updated metrics
      const tokens = await prisma.token.findMany({
        where: { address: testTokenAddress },
        include: { metrics: true }
      });

      expect(tokens).toHaveLength(1);
      expect(tokens[0].metrics.length).toBeGreaterThan(1); // Multiple metric entries
    });

    it('should filter out tokens that fail safety checks', async () => {
      const suspiciousTokenData = {
        pairs: [{
          baseToken: {
            address: '6gMq3mLu1kB9x7JN4VeK2uH8nQ5tR3wS9cF2dE8aP7nT',
            name: 'Suspicious Token',
            symbol: 'SCAM'
          },
          liquidity: { usd: 100 }, // Very low liquidity
          volume: { h24: 50 } // Very low volume
        }]
      };

      jest.spyOn(dexScreenerService, 'getLatestTokens')
        .mockResolvedValue(suspiciousTokenData);

      jest.spyOn(safetyService, 'analyzeToken')
        .mockResolvedValue({
          riskScore: 85, // High risk
          liquidityRisk: 9,
          ownershipRisk: 8,
          tradingRisk: 9,
          technicalRisk: 7,
          isRugPull: true,
          isHoneypot: false
        });

      const aggregatedData = await aggregatorService.processNewTokens();

      // Should be filtered out due to high risk
      expect(aggregatedData).toHaveLength(0);

      const storedTokens = await prisma.token.findMany();
      expect(storedTokens).toHaveLength(0);
    });
  });

  describe('Real-time Data Flow', () => {
    it('should update existing token metrics in real-time', async () => {
      // Create initial token
      const token = await prisma.token.create({
        data: {
          address: testTokenAddress,
          symbol: 'TEST',
          name: 'Test Token',
          decimals: 9,
          totalSupply: '1000000000',
          chain: 'solana',
          isActive: true
        }
      });

      // Simulate real-time price update
      const updatedData = {
        pairs: [{
          baseToken: {
            address: testTokenAddress,
            name: 'Test Token',
            symbol: 'TEST'
          },
          priceUsd: '0.0200',
          volume: { h24: 120000 },
          priceChange: { h24: 28.2 }
        }]
      };

      jest.spyOn(dexScreenerService, 'getTokenPairs')
        .mockResolvedValue(updatedData);

      // Process update
      await aggregatorService.updateTokenMetrics([testTokenAddress]);

      // Verify metrics updated
      const updatedToken = await prisma.token.findUnique({
        where: { id: token.id },
        include: { metrics: { orderBy: { timestamp: 'desc' } } }
      });

      const latestMetrics = updatedToken?.metrics[0];
      expect(latestMetrics?.price).toBeCloseTo(0.02);
      expect(latestMetrics?.volume24h).toBe(120000);
      expect(latestMetrics?.priceChange24h).toBeCloseTo(28.2);
    });

    it('should handle service failures gracefully', async () => {
      // Mock service failure
      jest.spyOn(dexScreenerService, 'getLatestTokens')
        .mockRejectedValue(new Error('Service Unavailable'));

      // Should not throw error
      const result = await aggregatorService.processNewTokens();
      expect(result).toEqual([]);

      // Database should remain unchanged
      const tokens = await prisma.token.findMany();
      expect(tokens).toHaveLength(0);
    });
  });

  describe('Performance Tests', () => {
    it('should process large batches efficiently', async () => {
      const batchSize = 100;
      const mockTokens = Array.from({ length: batchSize }, (_, i) => ({
        baseToken: {
          address: `token_${i.toString().padStart(10, '0')}`,
          name: `Token ${i}`,
          symbol: `TK${i}`
        },
        priceUsd: (Math.random() * 10).toString(),
        volume: { h24: Math.floor(Math.random() * 100000) }
      }));

      jest.spyOn(dexScreenerService, 'getLatestTokens')
        .mockResolvedValue({ pairs: mockTokens });

      const startTime = Date.now();
      const result = await aggregatorService.processNewTokens();
      const processingTime = Date.now() - startTime;

      // Should process within reasonable time (< 5 seconds for 100 tokens)
      expect(processingTime).toBeLessThan(5000);
      expect(result).toHaveLength(batchSize);

      // Verify all tokens stored
      const storedTokens = await prisma.token.findMany();
      expect(storedTokens).toHaveLength(batchSize);
    }, 10000); // Extended timeout for performance test

    it('should handle concurrent processing', async () => {
      const mockTokenData = {
        pairs: [{
          baseToken: {
            address: testTokenAddress,
            name: 'Test Token',
            symbol: 'TEST'
          },
          priceUsd: '0.0156'
        }]
      };

      jest.spyOn(dexScreenerService, 'getLatestTokens')
        .mockResolvedValue(mockTokenData);

      // Process concurrently
      const promises = Array(5).fill(null).map(() =>
        aggregatorService.processNewTokens()
      );

      const results = await Promise.all(promises);

      // Should handle concurrent access without errors
      results.forEach(result => {
        expect(result).toHaveLength(1);
      });

      // Should have only one token (no duplicates)
      const tokens = await prisma.token.findMany();
      expect(tokens).toHaveLength(1);
    });
  });
});