/**
 * DatabaseService.ts - Comprehensive database operations service
 * Handles CRUD operations for tokens, analysis, filters, and alerts
 */
import { PoolClient } from 'pg';
import { CombinedTokenAnalysis, TokenFilterCriteria } from '../types/api.types';
export interface DexAnalysisData {
    pairs: Array<{
        dexId: string;
        pairAddress: string;
        priceUsd: string;
        volume24h: number;
        liquidity: number;
        priceChange24h: number;
    }>;
    marketCap: number;
    holders: number;
    lastUpdated: string;
}
export interface RugAnalysisData {
    mintAuthority: boolean;
    freezeAuthority: boolean;
    liquidityLocked: boolean;
    holderConcentration: number;
    topHolders: Array<{
        address: string;
        percentage: number;
    }>;
    risks: string[];
    warnings: string[];
    safetyChecks: {
        hasWebsite: boolean;
        hasLiquidity: boolean;
        hasVolume: boolean;
    };
}
export interface JupiterAnalysisData {
    routeCount: number;
    slippageEstimate: number;
    spread: number;
    liquidityUsd: number;
    priceImpact: number;
    routeQuality: 'good' | 'moderate' | 'poor';
    lastQuoteTime: string;
}
export interface SolscanAnalysisData {
    creatorWallet: string;
    creationTimestamp: number;
    initialLiquidity: number;
    holderDistribution: {
        top10Percentage: number;
        uniqueHolders: number;
    };
    transactionMetrics: {
        totalTransactions: number;
        avgVolumePerTx: number;
        uniqueTraders: number;
    };
    creatorHistory: {
        tokensCreated: number;
        successfulTokens: number;
        ruggedTokens: number;
    };
}
export interface FilterCriteriaJson {
    minMarketCap?: number;
    maxMarketCap?: number;
    minPrice?: number;
    maxPrice?: number;
    minVolume24h?: number;
    minRugScore?: number;
    maxRiskScore?: number;
    allowHoneypot?: boolean;
    allowMintAuthority?: boolean;
    minAge?: number;
    maxAge?: number;
    firstDetectedHours?: {
        min?: number;
        max?: number;
    };
    minLiquidity?: number;
    maxSlippage?: number;
    minHolderCount?: number;
    maxTopHoldersPercentage?: number;
    minOverallScore?: number;
    minOpportunityScore?: number;
    customConditions?: Array<{
        field: string;
        operator: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';
        value: string | number | boolean;
    }>;
}
export interface AlertDataJson {
    priceData?: {
        currentPrice: number;
        previousPrice: number;
        changePercentage: number;
        triggeredAt: string;
    };
    volumeData?: {
        currentVolume: number;
        averageVolume: number;
        volumeSpike: number;
        timeframe: string;
    };
    riskData?: {
        riskType: string;
        severity: number;
        description: string;
        affectedMetrics: string[];
    };
    scoreData?: {
        previousScore: number;
        currentScore: number;
        scoreDelta: number;
        scoreType: 'overall' | 'risk' | 'opportunity';
    };
    metadata?: {
        sourceService: string;
        confidence: number;
        additionalContext?: Record<string, string | number | boolean>;
    };
}
export interface TemplateJson {
    name: string;
    description: string;
    criteria: FilterCriteriaJson;
    defaultValues: Record<string, string | number | boolean>;
    uiConfig?: {
        displayOrder: string[];
        groupings: Record<string, string[]>;
        labels: Record<string, string>;
        helpText: Record<string, string>;
    };
}
export interface DbToken {
    address: string;
    symbol: string;
    name: string;
    decimals?: number;
    supply?: string;
    market_cap?: string;
    price_usd?: string;
    volume_24h?: string;
    description?: string;
    image_url?: string;
    website_url?: string;
    twitter_url?: string;
    telegram_url?: string;
    first_detected_at: Date;
    created_at: Date;
    last_updated_at: Date;
    is_active: boolean;
    is_verified: boolean;
    is_scam: boolean;
    is_honeypot: boolean;
    price_last_updated?: Date;
    volume_last_updated?: Date;
}
export interface DbTokenAnalysis {
    id: string;
    token_address: string;
    analysis_timestamp: Date;
    dex_data?: DexAnalysisData;
    dex_score?: number;
    dex_last_updated?: Date;
    rug_data?: RugAnalysisData;
    rug_score?: number;
    rug_risk_level?: string;
    rug_last_updated?: Date;
    jupiter_data?: JupiterAnalysisData;
    jupiter_liquidity?: string;
    jupiter_price?: string;
    jupiter_last_updated?: Date;
    solscan_data?: SolscanAnalysisData;
    solscan_holder_count?: number;
    solscan_transaction_count?: number;
    solscan_last_updated?: Date;
    overall_score?: number;
    risk_score?: number;
    opportunity_score?: number;
    analysis_complete: boolean;
    has_errors: boolean;
    error_details?: string;
    created_at: Date;
    updated_at: Date;
}
export interface DbUserFilter {
    id: string;
    name: string;
    description?: string;
    criteria_json: FilterCriteriaJson;
    is_active: boolean;
    is_public: boolean;
    user_id?: string;
    created_by?: string;
    usage_count: number;
    last_used_at?: Date;
    created_at: Date;
    updated_at: Date;
}
export interface DbAlert {
    id: string;
    token_address: string;
    alert_type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    message: string;
    alert_data?: AlertDataJson;
    trigger_value?: string;
    threshold_value?: string;
    user_id?: string;
    filter_id?: string;
    acknowledged: boolean;
    acknowledged_at?: Date;
    acknowledged_by?: string;
    dismissed: boolean;
    dismissed_at?: Date;
    created_at: Date;
    expires_at?: Date;
}
export interface FilterTemplate {
    id: string;
    name: string;
    description?: string;
    category: string;
    template_json: TemplateJson;
    is_active: boolean;
    sort_order: number;
    icon?: string;
    color?: string;
    usage_count: number;
    created_at: Date;
    updated_at: Date;
}
export interface DatabaseConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean;
    max?: number;
    connectionTimeoutMillis?: number;
    idleTimeoutMillis?: number;
}
export interface QueryOptions {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
    filters?: Record<string, string | number | boolean>;
}
export interface BulkInsertOptions {
    batchSize?: number;
    onConflict?: 'ignore' | 'update' | 'error';
    conflictColumns?: string[];
}
export declare class DatabaseService {
    private pool;
    private config;
    constructor(config: DatabaseConfig);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    runMigration(migrationPath: string): Promise<void>;
    healthCheck(): Promise<{
        healthy: boolean;
        latency: number;
        error?: string;
    }>;
    createToken(tokenData: Partial<DbToken>): Promise<DbToken>;
    updateToken(address: string, updates: Partial<DbToken>): Promise<DbToken | null>;
    getToken(address: string): Promise<DbToken | null>;
    getTokens(options?: QueryOptions): Promise<DbToken[]>;
    bulkInsertTokens(tokens: Partial<DbToken>[], options?: BulkInsertOptions): Promise<void>;
    private insertTokenBatch;
    createTokenAnalysis(analysisData: Partial<DbTokenAnalysis>): Promise<DbTokenAnalysis>;
    getLatestTokenAnalysis(tokenAddress: string): Promise<DbTokenAnalysis | null>;
    getTokenAnalysisHistory(tokenAddress: string, options?: QueryOptions): Promise<DbTokenAnalysis[]>;
    bulkInsertAnalysis(analysisData: Partial<DbTokenAnalysis>[], options?: BulkInsertOptions): Promise<void>;
    private insertAnalysisBatch;
    createUserFilter(filterData: Partial<DbUserFilter>): Promise<DbUserFilter>;
    getUserFilters(userId: string, options?: QueryOptions): Promise<DbUserFilter[]>;
    getFilterTemplates(): Promise<FilterTemplate[]>;
    incrementFilterUsage(filterId: string): Promise<void>;
    applyFilters(tokenAddresses: string[], criteria: TokenFilterCriteria): Promise<string[]>;
    createAlert(alertData: Partial<DbAlert>): Promise<string>;
    getUserAlerts(userId: string, options?: QueryOptions & {
        unreadOnly?: boolean;
    }): Promise<DbAlert[]>;
    acknowledgeAlert(alertId: string, userId: string): Promise<boolean>;
    dismissAlert(alertId: string, userId: string): Promise<boolean>;
    cleanupExpiredAlerts(): Promise<number>;
    getTopOpportunities(limit?: number): Promise<Array<{
        address: string;
        symbol: string;
        name: string;
        market_cap: string;
        volume_24h: string;
        price_usd: string;
        overall_score: number;
        opportunity_score: number;
        risk_score: number;
        analysis_timestamp: Date;
    }>>;
    getRecentDiscoveries(hours?: number): Promise<Array<{
        address: string;
        symbol: string;
        name: string;
        market_cap: string;
        volume_24h: string;
        first_detected_at: Date;
        overall_score: number;
        risk_score: number;
        hours_since_discovery: number;
    }>>;
    getUnreadAlertsCount(userId: string): Promise<number>;
    getTokenStatistics(): Promise<{
        total: number;
        active: number;
        analyzed: number;
        recentlyAdded: number;
    }>;
    withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
    storeCombinedAnalysis(analysis: CombinedTokenAnalysis): Promise<void>;
}
//# sourceMappingURL=DatabaseService.d.ts.map