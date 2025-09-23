/**
 * Health Check Service for All API Services
 * Hive Mind Integration - System Health Monitoring
 */

import { ServiceHealthCheck, ApiResponse } from '../types/api.types';
import { DexScreenerService } from './dexscreener.service';
import { RugCheckService } from './rugcheck.service';
import { JupiterService } from './jupiter.service';
import { SolscanService } from './solscan.service';
import { Logger } from '../utils/logger';
import { globalCache } from '../utils/cache';

export interface ApiService {
  healthCheck(): Promise<ServiceHealthCheck>;
  getStats?(): Record<string, unknown>;
}

export interface SystemHealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealthCheck[];
  totalLatency: number;
  healthyServices: number;
  totalServices: number;
  uptime: number;
  lastCheck: Date;
}

export class HealthCheckService {
  private readonly logger = Logger.getInstance();
  private readonly services: Map<string, { service: ApiService; enabled: boolean }> = new Map();
  private readonly startTime = Date.now();

  constructor() {
    this.initializeServices();
  }

  private initializeServices(): void {
    this.services.set('dexscreener', {
      service: new DexScreenerService(),
      enabled: true
    });

    this.services.set('rugcheck', {
      service: new RugCheckService(),
      enabled: true
    });

    this.services.set('jupiter', {
      service: new JupiterService(),
      enabled: true
    });

    this.services.set('solscan', {
      service: new SolscanService(),
      enabled: true
    });
  }

  async checkAllServices(): Promise<ApiResponse<SystemHealthReport>> {
    try {
      const cacheKey = 'health:system:all';

      // Check cache (short TTL for health checks)
      const cached = globalCache.get<SystemHealthReport>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          timestamp: new Date(),
          source: 'health-check'
        };
      }

      this.logger.info('Starting system health check');
      const startTime = Date.now();

      // Run all health checks in parallel
      const healthChecks = await Promise.allSettled(
        Array.from(this.services.entries())
          .filter(([_, config]) => config.enabled)
          .map(async ([name, config]) => {
            try {
              const healthCheck = await config.service.healthCheck();
              return { name, healthCheck };
            } catch (error) {
              return {
                name,
                healthCheck: {
                  service: name,
                  healthy: false,
                  latency: 0,
                  errorRate: 100,
                  lastCheck: new Date(),
                  endpoint: 'unknown'
                } as ServiceHealthCheck
              };
            }
          })
      );

      // Process results
      const serviceResults: ServiceHealthCheck[] = [];
      let totalLatency = 0;
      let healthyCount = 0;

      healthChecks.forEach(result => {
        if (result.status === 'fulfilled') {
          const { healthCheck } = result.value;
          serviceResults.push(healthCheck);
          totalLatency += healthCheck.latency;

          if (healthCheck.healthy) {
            healthyCount++;
          }
        }
      });

      // Determine overall health
      const healthPercentage = healthyCount / serviceResults.length;
      let overall: 'healthy' | 'degraded' | 'unhealthy';

      if (healthPercentage >= 0.8) {
        overall = 'healthy';
      } else if (healthPercentage >= 0.5) {
        overall = 'degraded';
      } else {
        overall = 'unhealthy';
      }

      const report: SystemHealthReport = {
        overall,
        services: serviceResults,
        totalLatency,
        healthyServices: healthyCount,
        totalServices: serviceResults.length,
        uptime: Date.now() - this.startTime,
        lastCheck: new Date()
      };

      // Cache for 30 seconds
      globalCache.set(cacheKey, report, 30);

      this.logger.info('System health check completed', {
        overall,
        healthyServices: healthyCount,
        totalServices: serviceResults.length,
        totalLatency
      });

      // Store in hive memory
      await this.storeHealthInHiveMemory(report);

      return {
        success: true,
        data: report,
        timestamp: new Date(),
        source: 'health-check'
      };

    } catch (error) {
      this.logger.error('System health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        source: 'health-check'
      };
    }
  }

  async checkService(serviceName: string): Promise<ApiResponse<ServiceHealthCheck>> {
    try {
      const serviceConfig = this.services.get(serviceName);
      if (!serviceConfig) {
        throw new Error(`Service '${serviceName}' not found`);
      }

      if (!serviceConfig.enabled) {
        throw new Error(`Service '${serviceName}' is disabled`);
      }

      const healthCheck = await serviceConfig.service.healthCheck();

      return {
        success: true,
        data: healthCheck,
        timestamp: new Date(),
        source: 'health-check'
      };

    } catch (error) {
      this.logger.error(`Health check failed for service: ${serviceName}`, {
        service: serviceName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        source: 'health-check'
      };
    }
  }

  async getServiceStats(): Promise<Record<string, unknown>> {
    const stats: Record<string, unknown> = {};

    for (const [name, config] of this.services.entries()) {
      if (config.enabled && typeof config.service.getStats === 'function') {
        try {
          stats[name] = config.service.getStats();
        } catch (error) {
          stats[name] = { error: 'Failed to get stats' };
        }
      }
    }

    return stats;
  }

  enableService(serviceName: string): boolean {
    const service = this.services.get(serviceName);
    if (service) {
      service.enabled = true;
      this.logger.info(`Service enabled: ${serviceName}`);
      return true;
    }
    return false;
  }

  disableService(serviceName: string): boolean {
    const service = this.services.get(serviceName);
    if (service) {
      service.enabled = false;
      this.logger.warn(`Service disabled: ${serviceName}`);
      return true;
    }
    return false;
  }

  getServiceStatus(): Record<string, { enabled: boolean; available: boolean }> {
    const status: Record<string, { enabled: boolean; available: boolean }> = {};

    for (const [name, config] of this.services.entries()) {
      status[name] = {
        enabled: config.enabled,
        available: config.service !== null
      };
    }

    return status;
  }

  private async storeHealthInHiveMemory(report: SystemHealthReport): Promise<void> {
    try {
      const hiveData = {
        overall: report.overall,
        healthyServices: report.healthyServices,
        totalServices: report.totalServices,
        uptime: report.uptime,
        timestamp: report.lastCheck.getTime()
      };

      globalCache.set('hive:health:system', hiveData, 60);

      // Store individual service health
      report.services.forEach(service => {
        globalCache.set(`hive:health:${service.service}`, {
          healthy: service.healthy,
          latency: service.latency,
          errorRate: service.errorRate,
          endpoint: service.endpoint
        }, 60);
      });

    } catch (error) {
      this.logger.warn('Failed to store health data in hive memory', { error });
    }
  }

  // Monitoring and alerting capabilities
  async startContinuousMonitoring(intervalMs: number = 60000): Promise<void> {
    this.logger.info('Starting continuous health monitoring', { intervalMs });

    const monitor = async () => {
      try {
        const healthReport = await this.checkAllServices();

        if (healthReport.success && healthReport.data) {
          const report = healthReport.data;

          // Log health status
          this.logger.info('Health monitoring update', {
            overall: report.overall,
            healthy: report.healthyServices,
            total: report.totalServices,
            uptime: report.uptime
          });

          // Alert on degraded/unhealthy status
          if (report.overall !== 'healthy') {
            this.logger.warn('System health degraded', {
              overall: report.overall,
              unhealthyServices: report.services
                .filter(s => !s.healthy)
                .map(s => s.service)
            });
          }
        }
      } catch (error) {
        this.logger.error('Health monitoring error', { error });
      }
    };

    // Initial check
    await monitor();

    // Schedule periodic checks
    setInterval(monitor, intervalMs);
  }

  getUptime(): number {
    return Date.now() - this.startTime;
  }

  getUptimeFormatted(): string {
    const uptime = this.getUptime();
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else {
      return `${minutes}m ${seconds % 60}s`;
    }
  }
}

// Singleton instance
export const healthCheckService = new HealthCheckService();