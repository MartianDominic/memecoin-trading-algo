/**
 * Jupiter Aggregator Service
 * Hive Mind Integration - DEX Routing and Slippage Analysis
 */
import { JupiterTokenData, ApiResponse, TokenFilterCriteria, ServiceHealthCheck } from '../types/api.types';
export interface JupiterToken {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    logoURI?: string;
    tags: string[];
}
export interface JupiterRoute {
    inputMint: string;
    inAmount: string;
    outputMint: string;
    outAmount: string;
    otherAmountThreshold: string;
    swapMode: string;
    slippageBps: number;
    priceImpactPct: string;
    marketInfos: Array<{
        id: string;
        label: string;
        inputMint: string;
        outputMint: string;
        notEnoughLiquidity: boolean;
        inAmount: string;
        outAmount: string;
        priceImpactPct: number;
        lpFee: {
            amount: string;
            mint: string;
            pct: number;
        };
        platformFee: {
            amount: string;
            mint: string;
            pct: number;
        };
    }>;
}
export declare class JupiterService {
    private readonly client;
    private readonly rateLimiter;
    private readonly logger;
    private readonly serviceName;
    private readonly testAmounts;
    private readonly usdcMint;
    private readonly solMint;
    private readonly blacklistedTokens;
    constructor();
    private setupInterceptors;
    private loadBlacklist;
    analyzeToken(tokenAddress: string, filters?: TokenFilterCriteria): Promise<ApiResponse<JupiterTokenData>>;
    private checkRouting;
    private analyzeSlippage;
    private analyzeVolume;
    private getQuote;
    private buildTokenAnalysis;
    private applyRoutingFilters;
    getTokenList(): Promise<ApiResponse<JupiterToken[]>>;
    healthCheck(): Promise<ServiceHealthCheck>;
    private storeInHiveMemory;
    getStats(): {
        requests: number;
        backoff: number;
        cacheHits: number;
        blacklistedTokens: number;
    };
}
//# sourceMappingURL=jupiter.service.d.ts.map