import { SchedulerService } from '@backend/services/SchedulerService';
import { TokenAggregatorService } from '@backend/services/TokenAggregatorService';
import { jest } from '@jest/globals';
import cron from 'node-cron';

// Mock node-cron
jest.mock('node-cron');
const mockedCron = cron as jest.Mocked<typeof cron>;

// Mock services
jest.mock('@backend/services/TokenAggregatorService');

describe('SchedulerService', () => {
  let schedulerService: SchedulerService;
  let mockAggregatorService: jest.Mocked<TokenAggregatorService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocked aggregator service
    mockAggregatorService = {
      processNewTokens: jest.fn(),
      updateTokenMetrics: jest.fn(),
      cleanup: jest.fn()
    } as unknown as jest.Mocked<TokenAggregatorService>;

    schedulerService = new SchedulerService(mockAggregatorService);
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(schedulerService).toBeDefined();
      expect(schedulerService['isRunning']).toBe(false);
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        tokenDiscoveryInterval: '*/10 * * * *', // Every 10 minutes
        metricsUpdateInterval: '*/2 * * * *',   // Every 2 minutes
        cleanupInterval: '0 0 * * *'            // Daily at midnight
      };

      const customScheduler = new SchedulerService(mockAggregatorService, customConfig);
      expect(customScheduler).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start all scheduled tasks', async () => {
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn(),
        destroy: jest.fn()
      };

      mockedCron.schedule.mockReturnValue(mockTask);

      await schedulerService.start();

      expect(schedulerService['isRunning']).toBe(true);
      expect(mockedCron.schedule).toHaveBeenCalledTimes(3); // 3 scheduled tasks
      expect(mockTask.start).toHaveBeenCalledTimes(3);
    });

    it('should not start if already running', async () => {
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn(),
        destroy: jest.fn()
      };

      mockedCron.schedule.mockReturnValue(mockTask);

      await schedulerService.start();
      await schedulerService.start(); // Second call

      expect(mockedCron.schedule).toHaveBeenCalledTimes(3); // Only called once
    });

    it('should handle startup errors gracefully', async () => {
      mockedCron.schedule.mockImplementation(() => {
        throw new Error('Cron setup failed');
      });

      await expect(schedulerService.start()).rejects.toThrow('Cron setup failed');
      expect(schedulerService['isRunning']).toBe(false);
    });
  });

  describe('stop', () => {
    it('should stop all scheduled tasks', async () => {
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn(),
        destroy: jest.fn()
      };

      mockedCron.schedule.mockReturnValue(mockTask);

      await schedulerService.start();
      await schedulerService.stop();

      expect(schedulerService['isRunning']).toBe(false);
      expect(mockTask.stop).toHaveBeenCalledTimes(3);
    });

    it('should handle stop when not running', async () => {
      await expect(schedulerService.stop()).resolves.not.toThrow();
      expect(schedulerService['isRunning']).toBe(false);
    });
  });

  describe('scheduled tasks execution', () => {
    let tokenDiscoveryCallback: () => Promise<void>;
    let metricsUpdateCallback: () => Promise<void>;
    let cleanupCallback: () => Promise<void>;

    beforeEach(async () => {
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn(),
        destroy: jest.fn()
      };

      mockedCron.schedule.mockImplementation((schedule, callback) => {
        if (schedule === '*/5 * * * *') { // Token discovery
          tokenDiscoveryCallback = callback as () => Promise<void>;
        } else if (schedule === '*/1 * * * *') { // Metrics update
          metricsUpdateCallback = callback as () => Promise<void>;
        } else if (schedule === '0 */6 * * *') { // Cleanup
          cleanupCallback = callback as () => Promise<void>;
        }
        return mockTask;
      });

      await schedulerService.start();
    });

    describe('token discovery task', () => {
      it('should execute token discovery every 5 minutes', async () => {
        mockAggregatorService.processNewTokens.mockResolvedValue([
          {
            address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
            symbol: 'TEST',
            name: 'Test Token'
          }
        ]);

        await tokenDiscoveryCallback();

        expect(mockAggregatorService.processNewTokens).toHaveBeenCalledTimes(1);
      });

      it('should handle token discovery errors', async () => {
        mockAggregatorService.processNewTokens.mockRejectedValue(
          new Error('API unavailable')
        );

        // Should not throw error (error should be logged)
        await expect(tokenDiscoveryCallback()).resolves.not.toThrow();
        expect(mockAggregatorService.processNewTokens).toHaveBeenCalledTimes(1);
      });

      it('should track token discovery metrics', async () => {
        const mockTokens = Array.from({ length: 25 }, (_, i) => ({
          address: `token_${i}`,
          symbol: `TK${i}`,
          name: `Token ${i}`
        }));

        mockAggregatorService.processNewTokens.mockResolvedValue(mockTokens);

        await tokenDiscoveryCallback();

        const metrics = schedulerService.getMetrics();
        expect(metrics.tokenDiscovery.totalExecutions).toBe(1);
        expect(metrics.tokenDiscovery.tokensDiscovered).toBe(25);
        expect(metrics.tokenDiscovery.lastExecution).toBeDefined();
      });
    });

    describe('metrics update task', () => {
      it('should execute metrics update every minute', async () => {
        mockAggregatorService.updateTokenMetrics.mockResolvedValue(undefined);

        await metricsUpdateCallback();

        expect(mockAggregatorService.updateTokenMetrics).toHaveBeenCalledTimes(1);
      });

      it('should handle metrics update errors', async () => {
        mockAggregatorService.updateTokenMetrics.mockRejectedValue(
          new Error('Database connection failed')
        );

        await expect(metricsUpdateCallback()).resolves.not.toThrow();
        expect(mockAggregatorService.updateTokenMetrics).toHaveBeenCalledTimes(1);
      });

      it('should track metrics update statistics', async () => {
        mockAggregatorService.updateTokenMetrics.mockResolvedValue(undefined);

        await metricsUpdateCallback();
        await metricsUpdateCallback();

        const metrics = schedulerService.getMetrics();
        expect(metrics.metricsUpdate.totalExecutions).toBe(2);
        expect(metrics.metricsUpdate.lastExecution).toBeDefined();
      });
    });

    describe('cleanup task', () => {
      it('should execute cleanup every 6 hours', async () => {
        mockAggregatorService.cleanup.mockResolvedValue(undefined);

        await cleanupCallback();

        expect(mockAggregatorService.cleanup).toHaveBeenCalledTimes(1);
      });

      it('should handle cleanup errors', async () => {
        mockAggregatorService.cleanup.mockRejectedValue(
          new Error('Cleanup failed')
        );

        await expect(cleanupCallback()).resolves.not.toThrow();
        expect(mockAggregatorService.cleanup).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('manual task execution', () => {
    beforeEach(async () => {
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn(),
        destroy: jest.fn()
      };

      mockedCron.schedule.mockReturnValue(mockTask);
      await schedulerService.start();
    });

    it('should allow manual token discovery execution', async () => {
      mockAggregatorService.processNewTokens.mockResolvedValue([]);

      await schedulerService.executeTokenDiscovery();

      expect(mockAggregatorService.processNewTokens).toHaveBeenCalledTimes(1);

      const metrics = schedulerService.getMetrics();
      expect(metrics.tokenDiscovery.totalExecutions).toBe(1);
    });

    it('should allow manual metrics update execution', async () => {
      mockAggregatorService.updateTokenMetrics.mockResolvedValue(undefined);

      await schedulerService.executeMetricsUpdate();

      expect(mockAggregatorService.updateTokenMetrics).toHaveBeenCalledTimes(1);

      const metrics = schedulerService.getMetrics();
      expect(metrics.metricsUpdate.totalExecutions).toBe(1);
    });

    it('should allow manual cleanup execution', async () => {
      mockAggregatorService.cleanup.mockResolvedValue(undefined);

      await schedulerService.executeCleanup();

      expect(mockAggregatorService.cleanup).toHaveBeenCalledTimes(1);

      const metrics = schedulerService.getMetrics();
      expect(metrics.cleanup.totalExecutions).toBe(1);
    });
  });

  describe('performance monitoring', () => {
    beforeEach(async () => {
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn(),
        destroy: jest.fn()
      };

      mockedCron.schedule.mockReturnValue(mockTask);
      await schedulerService.start();
    });

    it('should track execution duration', async () => {
      // Mock a slow operation
      mockAggregatorService.processNewTokens.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      await schedulerService.executeTokenDiscovery();

      const metrics = schedulerService.getMetrics();
      expect(metrics.tokenDiscovery.averageExecutionTime).toBeGreaterThan(90);
      expect(metrics.tokenDiscovery.averageExecutionTime).toBeLessThan(200);
    });

    it('should track error rates', async () => {
      mockAggregatorService.processNewTokens
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce([]);

      await schedulerService.executeTokenDiscovery(); // Error
      await schedulerService.executeTokenDiscovery(); // Error
      await schedulerService.executeTokenDiscovery(); // Success

      const metrics = schedulerService.getMetrics();
      expect(metrics.tokenDiscovery.totalExecutions).toBe(3);
      expect(metrics.tokenDiscovery.totalErrors).toBe(2);
      expect(metrics.tokenDiscovery.errorRate).toBeCloseTo(0.667, 2);
    });

    it('should provide comprehensive metrics', () => {
      const metrics = schedulerService.getMetrics();

      expect(metrics).toHaveProperty('tokenDiscovery');
      expect(metrics).toHaveProperty('metricsUpdate');
      expect(metrics).toHaveProperty('cleanup');

      expect(metrics.tokenDiscovery).toHaveProperty('totalExecutions');
      expect(metrics.tokenDiscovery).toHaveProperty('totalErrors');
      expect(metrics.tokenDiscovery).toHaveProperty('errorRate');
      expect(metrics.tokenDiscovery).toHaveProperty('averageExecutionTime');
      expect(metrics.tokenDiscovery).toHaveProperty('tokensDiscovered');
      expect(metrics.tokenDiscovery).toHaveProperty('lastExecution');
    });
  });

  describe('health monitoring', () => {
    it('should report healthy status when running', async () => {
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn(),
        destroy: jest.fn()
      };

      mockedCron.schedule.mockReturnValue(mockTask);
      await schedulerService.start();

      const health = schedulerService.getHealthStatus();

      expect(health.isRunning).toBe(true);
      expect(health.status).toBe('healthy');
      expect(health.uptime).toBeGreaterThan(0);
    });

    it('should report unhealthy status when stopped', () => {
      const health = schedulerService.getHealthStatus();

      expect(health.isRunning).toBe(false);
      expect(health.status).toBe('stopped');
      expect(health.uptime).toBe(0);
    });

    it('should detect stale executions', async () => {
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn(),
        destroy: jest.fn()
      };

      mockedCron.schedule.mockReturnValue(mockTask);
      await schedulerService.start();

      // Mock stale execution (simulate time passing)
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now + 10 * 60 * 1000); // 10 minutes later

      const health = schedulerService.getHealthStatus();

      // Should detect that token discovery hasn't run recently
      expect(health.warnings).toContain(
        'Token discovery last ran more than 7 minutes ago'
      );

      jest.useRealTimers();
    });
  });
});