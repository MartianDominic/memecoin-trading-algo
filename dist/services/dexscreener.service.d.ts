/**
 * DEXScreener API Service
 * Hive Mind Integration - Token Launch and Metrics Detection
 */
import { DexScreenerTokenData, ApiResponse, TokenFilterCriteria, ServiceHealthCheck } from '../types/api.types';
export declare class DexScreenerService {
    private readonly client;
    private readonly rateLimiter;
    private readonly logger;
    private readonly serviceName;
    constructor();
    private setupInterceptors;
    getTokenData(tokenAddresses: string | string[], filters?: TokenFilterCriteria): Promise<ApiResponse<DexScreenerTokenData[]>>;
    getNewTokens(chain?: string, filters?: TokenFilterCriteria): Promise<ApiResponse<DexScreenerTokenData[]>>;
    private processTokenData;
    private calculateMarketCap;
    private applyFilters;
    healthCheck(): Promise<ServiceHealthCheck>;
    private storeInHiveMemory;
    getStats(): {
        requests: number;
        backoff: number;
        cacheHits: number;
    };
}
//# sourceMappingURL=dexscreener.service.d.ts.map