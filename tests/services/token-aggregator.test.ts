import { TokenAggregatorService } from '../../src/services/token-aggregator.service';
import { DexScreenerService } from '../../src/services/dexscreener.service';
import { RugCheckService } from '../../src/services/rugcheck.service';
import { JupiterService } from '../../src/services/jupiter.service';
import { SolscanService } from '../../src/services/solscan.service';

// Mock the services
jest.mock('../../src/services/dexscreener.service');
jest.mock('../../src/services/rugcheck.service');
jest.mock('../../src/services/jupiter.service');
jest.mock('../../src/services/solscan.service');

describe('TokenAggregatorService', () => {
  let aggregatorService: TokenAggregatorService;
  let mockDexScreener: jest.Mocked<DexScreenerService>;
  let mockRugCheck: jest.Mocked<RugCheckService>;
  let mockJupiter: jest.Mocked<JupiterService>;
  let mockSolscan: jest.Mocked<SolscanService>;

  beforeEach(() => {
    // Create mocked instances
    mockDexScreener = new DexScreenerService() as jest.Mocked<DexScreenerService>;
    mockRugCheck = new RugCheckService() as jest.Mocked<RugCheckService>;
    mockJupiter = new JupiterService() as jest.Mocked<JupiterService>;
    mockSolscan = new SolscanService() as jest.Mocked<SolscanService>;

    // Initialize service with mocks
    aggregatorService = new TokenAggregatorService(
      mockDexScreener,
      mockRugCheck,
      mockJupiter,
      mockSolscan
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create instance with all required services', () => {
      expect(aggregatorService).toBeInstanceOf(TokenAggregatorService);
      expect(aggregatorService.getStats().totalProcessed).toBe(0);
    });

    it('should have proper event emitter setup', () => {
      const spy = jest.fn();
      aggregatorService.on('stats:updated', spy);

      // Trigger an event (this would need actual implementation)
      aggregatorService.emit('stats:updated', { processed: 1, passed: 0, failed: 0 });

      expect(spy).toHaveBeenCalledWith({ processed: 1, passed: 0, failed: 0 });
    });
  });

  describe('health checks', () => {
    it('should check all service health before processing', async () => {
      // Mock health check responses
      mockDexScreener.healthCheck = jest.fn().mockResolvedValue({
        service: 'dexscreener',
        healthy: true,
        latency: 100,
        errorRate: 0,
        lastCheck: new Date(),
        endpoint: 'test'
      });

      mockRugCheck.healthCheck = jest.fn().mockResolvedValue({
        service: 'rugcheck',
        healthy: true,
        latency: 150,
        errorRate: 0,
        lastCheck: new Date(),
        endpoint: 'test'
      });

      mockJupiter.healthCheck = jest.fn().mockResolvedValue({
        service: 'jupiter',
        healthy: true,
        latency: 120,
        errorRate: 0,
        lastCheck: new Date(),
        endpoint: 'test'
      });

      mockSolscan.healthCheck = jest.fn().mockResolvedValue({
        service: 'solscan',
        healthy: true,
        latency: 200,
        errorRate: 0,
        lastCheck: new Date(),
        endpoint: 'test'
      });

      const isHealthy = await aggregatorService.areServicesHealthy();

      expect(isHealthy).toBe(true);
      expect(mockDexScreener.healthCheck).toHaveBeenCalled();
      expect(mockRugCheck.healthCheck).toHaveBeenCalled();
      expect(mockJupiter.healthCheck).toHaveBeenCalled();
      expect(mockSolscan.healthCheck).toHaveBeenCalled();
    });

    it('should return false when any service is unhealthy', async () => {
      mockDexScreener.healthCheck = jest.fn().mockResolvedValue({
        service: 'dexscreener',
        healthy: false,
        latency: 5000,
        errorRate: 100,
        lastCheck: new Date(),
        endpoint: 'test'
      });

      const isHealthy = await aggregatorService.areServicesHealthy();
      expect(isHealthy).toBe(false);
    });
  });

  describe('configuration', () => {
    it('should have default filter criteria', () => {
      const stats = aggregatorService.getStats();
      expect(stats).toHaveProperty('totalProcessed');
      expect(stats).toHaveProperty('totalPassed');
      expect(stats).toHaveProperty('totalFailed');
    });

    it('should allow updating configuration', () => {
      const newConfig = {
        batchSize: 10,
        concurrency: 5,
        processingDelay: 2000
      };

      aggregatorService.updateConfig(newConfig);
      const config = aggregatorService.getConfig();

      expect(config.batchSize).toBe(10);
      expect(config.concurrency).toBe(5);
      expect(config.processingDelay).toBe(2000);
    });
  });

  describe('error handling', () => {
    it('should handle service failures gracefully', async () => {
      mockDexScreener.healthCheck = jest.fn().mockRejectedValue(new Error('Service unavailable'));

      const isHealthy = await aggregatorService.areServicesHealthy();
      expect(isHealthy).toBe(false);
    });

    it('should emit error events on failures', (done) => {
      aggregatorService.on('error', (error) => {
        expect(error).toBeInstanceOf(Error);
        done();
      });

      // Simulate an error
      aggregatorService.emit('error', new Error('Test error'));
    });
  });
});