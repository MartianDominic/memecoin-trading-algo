/**
 * Solscan Creator and Holder Analysis Service
 * Hive Mind Integration - Token Creator Behavior Analysis
 */
import { SolscanTokenData, ApiResponse, TokenFilterCriteria, ServiceHealthCheck } from '../types/api.types';
export interface SolscanTransaction {
    signature: string;
    block: number;
    timestamp: number;
    fee: number;
    status: string;
    signer: string[];
}
export interface SolscanTokenInfo {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    supply: string;
    creator: string;
    createdTime: number;
}
export interface SolscanAccountTokens {
    tokenAddress: string;
    tokenAccount: string;
    tokenName: string;
    tokenSymbol: string;
    tokenIcon: string;
    rentEpoch: number;
    lamports: number;
    tokenAmount: {
        amount: string;
        decimals: number;
        uiAmount: number;
    };
}
export declare class SolscanService {
    private readonly apiKey?;
    private readonly client;
    private readonly rateLimiter;
    private readonly logger;
    private readonly serviceName;
    private readonly suspiciousWalletPatterns;
    private readonly minCreatorAge;
    constructor(apiKey?: string | undefined);
    private setupInterceptors;
    analyzeToken(tokenAddress: string, filters?: TokenFilterCriteria): Promise<ApiResponse<SolscanTokenData>>;
    private getTokenInfo;
    private getTokenHolders;
    private analyzeCreator;
    private getCreatorTokenHistory;
    private analyzeCreatorBehavior;
    private buildTokenAnalysis;
    private analyzeFundingPattern;
    private applyCreatorFilters;
    private simulateTokenInfo;
    private simulateTokenHolders;
    private simulateCreatorInfo;
    private simulateCreatorTokens;
    healthCheck(): Promise<ServiceHealthCheck>;
    private storeInHiveMemory;
    getStats(): {
        requests: number;
        backoff: number;
        cacheHits: number;
    };
}
//# sourceMappingURL=solscan.service.d.ts.map