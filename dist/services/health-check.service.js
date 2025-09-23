"use strict";
/**
 * Health Check Service for All API Services
 * Hive Mind Integration - System Health Monitoring
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthCheckService = exports.HealthCheckService = void 0;
const dexscreener_service_1 = require("./dexscreener.service");
const rugcheck_service_1 = require("./rugcheck.service");
const jupiter_service_1 = require("./jupiter.service");
const solscan_service_1 = require("./solscan.service");
const logger_1 = require("../utils/logger");
const cache_1 = require("../utils/cache");
class HealthCheckService {
    constructor() {
        this.logger = logger_1.Logger.getInstance();
        this.services = new Map();
        this.startTime = Date.now();
        this.initializeServices();
    }
    initializeServices() {
        this.services.set('dexscreener', {
            service: new dexscreener_service_1.DexScreenerService(),
            enabled: true
        });
        this.services.set('rugcheck', {
            service: new rugcheck_service_1.RugCheckService(),
            enabled: true
        });
        this.services.set('jupiter', {
            service: new jupiter_service_1.JupiterService(),
            enabled: true
        });
        this.services.set('solscan', {
            service: new solscan_service_1.SolscanService(),
            enabled: true
        });
    }
    async checkAllServices() {
        try {
            const cacheKey = 'health:system:all';
            // Check cache (short TTL for health checks)
            const cached = cache_1.globalCache.get(cacheKey);
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
            const healthChecks = await Promise.allSettled(Array.from(this.services.entries())
                .filter(([_, config]) => config.enabled)
                .map(async ([name, config]) => {
                try {
                    const healthCheck = await config.service.healthCheck();
                    return { name, healthCheck };
                }
                catch (error) {
                    return {
                        name,
                        healthCheck: {
                            service: name,
                            healthy: false,
                            latency: 0,
                            errorRate: 100,
                            lastCheck: new Date(),
                            endpoint: 'unknown'
                        }
                    };
                }
            }));
            // Process results
            const serviceResults = [];
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
            let overall;
            if (healthPercentage >= 0.8) {
                overall = 'healthy';
            }
            else if (healthPercentage >= 0.5) {
                overall = 'degraded';
            }
            else {
                overall = 'unhealthy';
            }
            const report = {
                overall,
                services: serviceResults,
                totalLatency,
                healthyServices: healthyCount,
                totalServices: serviceResults.length,
                uptime: Date.now() - this.startTime,
                lastCheck: new Date()
            };
            // Cache for 30 seconds
            cache_1.globalCache.set(cacheKey, report, 30);
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
        }
        catch (error) {
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
    async checkService(serviceName) {
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
        }
        catch (error) {
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
    async getServiceStats() {
        const stats = {};
        for (const [name, config] of this.services.entries()) {
            if (config.enabled && typeof config.service.getStats === 'function') {
                try {
                    stats[name] = config.service.getStats();
                }
                catch (error) {
                    stats[name] = { error: 'Failed to get stats' };
                }
            }
        }
        return stats;
    }
    enableService(serviceName) {
        const service = this.services.get(serviceName);
        if (service) {
            service.enabled = true;
            this.logger.info(`Service enabled: ${serviceName}`);
            return true;
        }
        return false;
    }
    disableService(serviceName) {
        const service = this.services.get(serviceName);
        if (service) {
            service.enabled = false;
            this.logger.warn(`Service disabled: ${serviceName}`);
            return true;
        }
        return false;
    }
    getServiceStatus() {
        const status = {};
        for (const [name, config] of this.services.entries()) {
            status[name] = {
                enabled: config.enabled,
                available: config.service !== null
            };
        }
        return status;
    }
    async storeHealthInHiveMemory(report) {
        try {
            const hiveData = {
                overall: report.overall,
                healthyServices: report.healthyServices,
                totalServices: report.totalServices,
                uptime: report.uptime,
                timestamp: report.lastCheck.getTime()
            };
            cache_1.globalCache.set('hive:health:system', hiveData, 60);
            // Store individual service health
            report.services.forEach(service => {
                cache_1.globalCache.set(`hive:health:${service.service}`, {
                    healthy: service.healthy,
                    latency: service.latency,
                    errorRate: service.errorRate,
                    endpoint: service.endpoint
                }, 60);
            });
        }
        catch (error) {
            this.logger.warn('Failed to store health data in hive memory', { error });
        }
    }
    // Monitoring and alerting capabilities
    async startContinuousMonitoring(intervalMs = 60000) {
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
            }
            catch (error) {
                this.logger.error('Health monitoring error', { error });
            }
        };
        // Initial check
        await monitor();
        // Schedule periodic checks
        setInterval(monitor, intervalMs);
    }
    getUptime() {
        return Date.now() - this.startTime;
    }
    getUptimeFormatted() {
        const uptime = this.getUptime();
        const seconds = Math.floor(uptime / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        }
        else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        }
        else {
            return `${minutes}m ${seconds % 60}s`;
        }
    }
}
exports.HealthCheckService = HealthCheckService;
// Singleton instance
exports.healthCheckService = new HealthCheckService();
//# sourceMappingURL=health-check.service.js.map