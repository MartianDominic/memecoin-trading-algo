/**
 * Shared API Types for Token Detection Pipeline
 * Hive Mind Integration - API Service Layer
 */
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    timestamp: Date;
    source: string;
}
export interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
    backoffMs: number;
    maxRetries: number;
}
export interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    backoffFactor: number;
}
export interface DexScreenerPair {
    chainId: string;
    dexId: string;
    url: string;
    pairAddress: string;
    baseToken: {
        address: string;
        name: string;
        symbol: string;
    };
    quoteToken: {
        address: string;
        name: string;
        symbol: string;
    };
    priceNative: string;
    priceUsd: string;
    txns: {
        m5: {
            buys: number;
            sells: number;
        };
        h1: {
            buys: number;
            sells: number;
        };
        h6: {
            buys: number;
            sells: number;
        };
        h24: {
            buys: number;
            sells: number;
        };
    };
    volume: {
        h24: number;
        h6: number;
        h1: number;
        m5: number;
    };
    priceChange: {
        m5: number;
        h1: number;
        h6: number;
        h24: number;
    };
    liquidity: {
        usd: number;
        base: number;
        quote: number;
    };
    pairCreatedAt: number;
}
export interface DexScreenerResponse {
    schemaVersion: string;
    pairs: DexScreenerPair[];
}
export interface DexScreenerTokenData {
    address: string;
    symbol: string;
    name: string;
    launchTimestamp: number;
    price: number;
    marketCap: number;
    volume24h: number;
    liquidity: number;
    age: number;
    filtered: boolean;
    filterReason?: string;
}
export interface RugCheckResult {
    address: string;
    honeypotRisk: boolean;
    mintAuthority: boolean;
    freezeAuthority: boolean;
    liquidityLocked: boolean;
    holderConcentration: number;
    safetyScore: number;
    risks: string[];
    warnings: string[];
    filtered: boolean;
    filterReason?: string;
}
export interface JupiterQuoteResponse {
    inputMint: string;
    inAmount: string;
    outputMint: string;
    outAmount: string;
    otherAmountThreshold: string;
    swapMode: string;
    slippageBps: number;
    platformFee?: {
        amount: string;
        feeBps: number;
    };
    priceImpactPct: string;
    routePlan: Array<{
        swapInfo: {
            ammKey: string;
            label: string;
            inputMint: string;
            outputMint: string;
            inAmount: string;
            outAmount: string;
            feeAmount: string;
            feeMint: string;
        };
        percent: number;
    }>;
}
export interface JupiterTokenData {
    address: string;
    routingAvailable: boolean;
    slippageEstimate: number;
    spread: number;
    volume24h: number;
    blacklisted: boolean;
    routeCount: number;
    filtered: boolean;
    filterReason?: string;
}
export interface SolscanTokenHolder {
    address: string;
    amount: string;
    decimals: number;
    owner: string;
    rank: number;
}
export interface SolscanCreatorInfo {
    address: string;
    createdTokens: number;
    ruggedTokens: number;
    successfulTokens: number;
    successRate: number;
    firstTokenDate: Date;
    averageHolding: number;
}
export interface SolscanTokenData {
    address: string;
    creatorWallet: string;
    creatorInfo: SolscanCreatorInfo;
    topHolders: SolscanTokenHolder[];
    topHoldersPercentage: number;
    fundingPattern: 'organic' | 'suspicious' | 'coordinated';
    filtered: boolean;
    filterReason?: string;
}
export interface TokenFilterCriteria {
    minAge?: number;
    maxAge?: number;
    minLiquidity?: number;
    minVolume?: number;
    minSafetyScore?: number;
    allowHoneypot?: boolean;
    maxSlippage?: number;
    requireRouting?: boolean;
    allowBlacklisted?: boolean;
    maxCreatorRugs?: number;
    maxTopHoldersPercentage?: number;
}
export interface CombinedTokenAnalysis {
    address: string;
    dexScreener: DexScreenerTokenData;
    rugCheck: RugCheckResult;
    jupiter: JupiterTokenData;
    solscan: SolscanTokenData;
    overallScore: number;
    passed: boolean;
    failedFilters: string[];
    timestamp: Date;
}
export interface ServiceHealthCheck {
    service: string;
    healthy: boolean;
    latency: number;
    errorRate: number;
    lastCheck: Date;
    endpoint: string;
}
export interface CacheEntry<T> {
    data: T;
    timestamp: Date;
    ttl: number;
    key: string;
}
//# sourceMappingURL=api.types.d.ts.map