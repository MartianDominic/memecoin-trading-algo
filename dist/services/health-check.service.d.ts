/**
 * Health Check Service for All API Services
 * Hive Mind Integration - System Health Monitoring
 */
import { ServiceHealthCheck, ApiResponse } from '../types/api.types';
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
export declare class HealthCheckService {
    private readonly logger;
    private readonly services;
    private readonly startTime;
    constructor();
    private initializeServices;
    checkAllServices(): Promise<ApiResponse<SystemHealthReport>>;
    checkService(serviceName: string): Promise<ApiResponse<ServiceHealthCheck>>;
    getServiceStats(): Promise<Record<string, unknown>>;
    enableService(serviceName: string): boolean;
    disableService(serviceName: string): boolean;
    getServiceStatus(): Record<string, {
        enabled: boolean;
        available: boolean;
    }>;
    private storeHealthInHiveMemory;
    startContinuousMonitoring(intervalMs?: number): Promise<void>;
    getUptime(): number;
    getUptimeFormatted(): string;
}
export declare const healthCheckService: HealthCheckService;
//# sourceMappingURL=health-check.service.d.ts.map