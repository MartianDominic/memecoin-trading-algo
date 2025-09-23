/**
 * RugCheck Security Analysis Service
 * Hive Mind Integration - Token Safety Assessment
 */
import { RugCheckResult, ApiResponse, TokenFilterCriteria, ServiceHealthCheck } from '../types/api.types';
export interface TokenMetadata {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    supply: string;
    mintAuthority: string | null;
    freezeAuthority: string | null;
}
export interface TokenAccount {
    address: string;
    amount: string;
    owner: string;
}
export declare class RugCheckService {
    private readonly client;
    private readonly rateLimiter;
    private readonly logger;
    private readonly serviceName;
    private readonly suspiciousPatterns;
    private readonly honeypotIndicators;
    constructor();
    private setupInterceptors;
    analyzeToken(tokenAddress: string, filters?: TokenFilterCriteria): Promise<ApiResponse<RugCheckResult>>;
    private getTokenMetadata;
    private getTokenAccounts;
    private analyzeLiquidity;
    private performSecurityAnalysis;
    private calculateHolderConcentration;
    private checkSuspiciousName;
    private detectHoneypotRisk;
    private applySecurityFilters;
    private simulateTokenMetadata;
    private simulateTokenAccounts;
    private simulateLiquidityAnalysis;
    healthCheck(): Promise<ServiceHealthCheck>;
    private storeInHiveMemory;
    getStats(): {
        requests: number;
        backoff: number;
        cacheHits: number;
    };
}
//# sourceMappingURL=rugcheck.service.d.ts.map