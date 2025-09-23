/**
 * Unit Tests for Token Detection Algorithm
 * Tests core detection logic, validation, and scoring mechanisms
 */

const TokenDetector = require('../../src/detectors/TokenDetector');
const { ValidationError, DetectionError } = require('../../src/utils/errors');

describe('TokenDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new TokenDetector({
      scoreThreshold: 0.7,
      maxAge: 3600000, // 1 hour
      networks: ['ethereum', 'bsc', 'polygon']
    });
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const defaultDetector = new TokenDetector();
      expect(defaultDetector.config.scoreThreshold).toBe(0.8);
      expect(defaultDetector.config.maxAge).toBe(300000);
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        scoreThreshold: 0.6,
        maxAge: 600000,
        networks: ['ethereum']
      };
      const customDetector = new TokenDetector(customConfig);
      expect(customDetector.config).toMatchObject(customConfig);
    });
  });

  describe('detectToken', () => {
    it('should detect valid memecoin with high score', async () => {
      const tokenData = {
        address: '0x1234567890123456789012345678901234567890',
        symbol: 'MEME',
        name: 'Meme Coin',
        decimals: 18,
        totalSupply: '1000000000000000000000000',
        liquidityUSD: 50000,
        volume24h: 100000,
        holders: 1500,
        createdAt: new Date(Date.now() - 3600000).toISOString()
      };

      const result = await detector.detectToken(tokenData);

      expect(result).toHaveProperty('isMemecoin', true);
      expect(result).toHaveProperty('score');
      expect(result.score).toBeGreaterThan(0.7);
      expect(result).toHaveProperty('factors');
      expect(result.factors).toHaveProperty('liquidityScore');
      expect(result.factors).toHaveProperty('volumeScore');
      expect(result.factors).toHaveProperty('holderScore');
    });

    it('should reject token with low liquidity', async () => {
      const tokenData = {
        address: '0x1234567890123456789012345678901234567890',
        symbol: 'LOW',
        name: 'Low Liquidity',
        decimals: 18,
        totalSupply: '1000000000000000000000000',
        liquidityUSD: 100, // Very low liquidity
        volume24h: 50,
        holders: 10,
        createdAt: new Date().toISOString()
      };

      const result = await detector.detectToken(tokenData);

      expect(result.isMemecoin).toBe(false);
      expect(result.score).toBeLessThan(0.5);
      expect(result.factors.liquidityScore).toBeLessThan(0.3);
    });

    it('should handle missing required fields', async () => {
      const invalidTokenData = {
        symbol: 'INCOMPLETE',
        name: 'Incomplete Token'
        // Missing address, decimals, etc.
      };

      await expect(detector.detectToken(invalidTokenData))
        .rejects.toThrow(ValidationError);
    });

    it('should validate token age requirements', async () => {
      const oldTokenData = {
        address: '0x1234567890123456789012345678901234567890',
        symbol: 'OLD',
        name: 'Old Token',
        decimals: 18,
        totalSupply: '1000000000000000000000000',
        liquidityUSD: 50000,
        volume24h: 100000,
        holders: 1500,
        createdAt: new Date(Date.now() - 7200000).toISOString() // 2 hours old
      };

      const result = await detector.detectToken(oldTokenData);

      expect(result.isMemecoin).toBe(false);
      expect(result.factors.ageScore).toBeLessThan(0.5);
    });
  });

  describe('calculateScore', () => {
    it('should calculate weighted score correctly', () => {
      const factors = {
        liquidityScore: 0.8,
        volumeScore: 0.7,
        holderScore: 0.9,
        ageScore: 1.0,
        contractScore: 0.6
      };

      const score = detector.calculateScore(factors);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
      // Verify weighted calculation
      const expectedScore = (0.8 * 0.25) + (0.7 * 0.2) + (0.9 * 0.2) + (1.0 * 0.15) + (0.6 * 0.2);
      expect(score).toBeCloseTo(expectedScore, 2);
    });

    it('should handle edge case scores', () => {
      const minFactors = {
        liquidityScore: 0,
        volumeScore: 0,
        holderScore: 0,
        ageScore: 0,
        contractScore: 0
      };
      expect(detector.calculateScore(minFactors)).toBe(0);

      const maxFactors = {
        liquidityScore: 1,
        volumeScore: 1,
        holderScore: 1,
        ageScore: 1,
        contractScore: 1
      };
      expect(detector.calculateScore(maxFactors)).toBe(1);
    });
  });

  describe('analyzeLiquidity', () => {
    it('should score high liquidity correctly', () => {
      const score = detector.analyzeLiquidity(100000); // $100k
      expect(score).toBeGreaterThan(0.8);
    });

    it('should score low liquidity correctly', () => {
      const score = detector.analyzeLiquidity(1000); // $1k
      expect(score).toBeLessThan(0.3);
    });

    it('should handle zero liquidity', () => {
      const score = detector.analyzeLiquidity(0);
      expect(score).toBe(0);
    });
  });

  describe('analyzeVolume', () => {
    it('should correlate volume with liquidity', () => {
      const liquidityUSD = 50000;
      const highVolume = detector.analyzeVolume(75000, liquidityUSD); // 150% of liquidity
      const lowVolume = detector.analyzeVolume(5000, liquidityUSD); // 10% of liquidity

      expect(highVolume).toBeGreaterThan(lowVolume);
      expect(highVolume).toBeGreaterThan(0.7);
      expect(lowVolume).toBeLessThan(0.5);
    });
  });

  describe('analyzeHolders', () => {
    it('should score holder distribution correctly', () => {
      const manyHolders = detector.analyzeHolders(2000);
      const fewHolders = detector.analyzeHolders(50);

      expect(manyHolders).toBeGreaterThan(fewHolders);
      expect(manyHolders).toBeGreaterThan(0.8);
      expect(fewHolders).toBeLessThan(0.4);
    });
  });

  describe('analyzeAge', () => {
    it('should favor recently created tokens', () => {
      const recentToken = new Date(Date.now() - 1800000); // 30 minutes ago
      const oldToken = new Date(Date.now() - 7200000); // 2 hours ago

      const recentScore = detector.analyzeAge(recentToken);
      const oldScore = detector.analyzeAge(oldToken);

      expect(recentScore).toBeGreaterThan(oldScore);
      expect(recentScore).toBeGreaterThan(0.8);
      expect(oldScore).toBeLessThan(0.5);
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      // Mock network failure
      detector.validateContract = jest.fn().mockRejectedValue(new Error('Network error'));

      const tokenData = global.testUtils.generateMockToken();

      await expect(detector.detectToken(tokenData))
        .rejects.toThrow(DetectionError);
    });

    it('should handle malformed data', async () => {
      const malformedData = {
        address: 'not-an-address',
        liquidityUSD: 'not-a-number',
        holders: -1
      };

      await expect(detector.detectToken(malformedData))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('performance', () => {
    it('should process detection within time limit', async () => {
      const tokenData = global.testUtils.generateMockToken();
      tokenData.liquidityUSD = 50000;
      tokenData.volume24h = 75000;
      tokenData.holders = 1500;

      const startTime = Date.now();
      await detector.detectToken(tokenData);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle concurrent detection requests', async () => {
      const tokens = Array(10).fill(null).map(() => {
        const token = global.testUtils.generateMockToken();
        token.liquidityUSD = 50000;
        token.volume24h = 75000;
        token.holders = 1500;
        return token;
      });

      const startTime = Date.now();
      const results = await Promise.all(
        tokens.map(token => detector.detectToken(token))
      );
      const endTime = Date.now();

      expect(results).toHaveLength(10);
      expect(results.every(r => r.hasOwnProperty('isMemecoin'))).toBe(true);
      expect(endTime - startTime).toBeLessThan(3000); // Should complete in under 3 seconds
    });
  });
});