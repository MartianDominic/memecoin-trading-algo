import { z } from 'zod';
import { TokenData, PriceInfo, SafetyAnalysis, TradingSignal } from '../../backend/src/types';
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    timestamp: string;
    version: string;
}
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}
export interface TokenListQuery {
    page?: number;
    limit?: number;
    search?: string;
    chain?: string;
    minMarketCap?: number;
    maxMarketCap?: number;
    minVolume?: number;
    sortBy?: 'marketCap' | 'volume24h' | 'priceChange24h' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
    riskLevel?: string[];
    hasLiquidity?: boolean;
}
export interface TokenResponse extends TokenData {
    currentPrice?: PriceInfo;
    safetyScore?: SafetyAnalysis;
    activeSignals?: TradingSignal[];
    performance?: {
        roi24h?: number;
        roi7d?: number;
        roi30d?: number;
        volatility?: number;
        sharpeRatio?: number;
    };
}
export interface CustomFilter {
    id: string;
    name: string;
    description?: string;
    criteria: FilterCriteria;
    userId?: string;
    isPublic: boolean;
    createdAt: string;
    updatedAt: string;
    useCount: number;
}
export interface FilterCriteria {
    marketCap?: {
        min?: number;
        max?: number;
    };
    volume24h?: {
        min?: number;
        max?: number;
    };
    priceChange?: {
        period: '1h' | '24h' | '7d';
        min?: number;
        max?: number;
    };
    safetyScore?: {
        min?: number;
        max?: number;
    };
    riskLevel?: ('VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH')[];
    liquidity?: {
        min?: number;
        required?: boolean;
    };
    holderCount?: {
        min?: number;
        max?: number;
    };
    contractAge?: {
        minDays?: number;
    };
    chain?: string[];
    signals?: {
        types?: string[];
        minStrength?: number;
        minConfidence?: number;
    };
}
export interface CreateFilterRequest {
    name: string;
    description?: string;
    criteria: FilterCriteria;
    isPublic?: boolean;
}
export interface Alert {
    id: string;
    type: 'PRICE_ALERT' | 'VOLUME_ALERT' | 'SAFETY_ALERT' | 'SIGNAL_ALERT' | 'NEWS_ALERT';
    title: string;
    message: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    tokenAddress?: string;
    tokenSymbol?: string;
    triggeredAt: string;
    acknowledgedAt?: string;
    isRead: boolean;
    metadata?: Record<string, any>;
}
export interface CreateAlertRequest {
    type: Alert['type'];
    tokenAddress?: string;
    condition: {
        metric: string;
        operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
        value: number;
        period?: string;
    };
    message?: string;
    severity?: Alert['severity'];
}
export interface AlertsQuery {
    page?: number;
    limit?: number;
    type?: Alert['type'];
    severity?: Alert['severity'];
    isRead?: boolean;
    tokenAddress?: string;
    startDate?: string;
    endDate?: string;
}
export interface DashboardSummary {
    totalTokens: number;
    totalVolume24h: number;
    totalMarketCap: number;
    activeAlerts: number;
    topPerformers: TokenResponse[];
    topLosers: TokenResponse[];
    riskDistribution: {
        [key in 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH']: number;
    };
    recentActivity: {
        newTokens: number;
        priceAlerts: number;
        volumeSpikes: number;
    };
    marketTrends: {
        bullishSignals: number;
        bearishSignals: number;
        neutralSignals: number;
    };
}
export interface AnalyticsQuery {
    period?: '1h' | '24h' | '7d' | '30d';
    chain?: string;
    category?: string;
}
export interface MarketMetrics {
    totalMarketCap: number;
    totalVolume24h: number;
    marketCapChange24h: number;
    volumeChange24h: number;
    activeTokens: number;
    newTokens24h: number;
    avgSafetyScore: number;
    dominanceIndex: number;
}
export interface PerformanceMetrics {
    timestamp: string;
    totalReturns: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    avgReturnPerTrade: number;
    totalTrades: number;
    successfulTrades: number;
}
export interface ExportQuery {
    format: 'csv' | 'json' | 'xlsx';
    filters?: FilterCriteria;
    fields?: string[];
    startDate?: string;
    endDate?: string;
    limit?: number;
}
export interface ExportResponse {
    downloadUrl: string;
    filename: string;
    size: number;
    expiresAt: string;
    recordCount: number;
}
export interface WebSocketMessage {
    type: 'TOKEN_UPDATE' | 'PRICE_UPDATE' | 'ALERT' | 'SIGNAL_UPDATE' | 'FILTER_RESULT';
    payload: any;
    timestamp: string;
    channel?: string;
}
export interface TokenUpdateMessage extends WebSocketMessage {
    type: 'TOKEN_UPDATE';
    payload: {
        address: string;
        priceData: PriceInfo;
        safetyScore?: SafetyAnalysis;
        signals?: TradingSignal[];
    };
}
export interface AlertMessage extends WebSocketMessage {
    type: 'ALERT';
    payload: Alert;
}
export interface FilterResultMessage extends WebSocketMessage {
    type: 'FILTER_RESULT';
    payload: {
        filterId: string;
        results: TokenResponse[];
        count: number;
    };
}
export declare const tokenListQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    search: z.ZodOptional<z.ZodString>;
    chain: z.ZodOptional<z.ZodString>;
    minMarketCap: z.ZodOptional<z.ZodNumber>;
    maxMarketCap: z.ZodOptional<z.ZodNumber>;
    minVolume: z.ZodOptional<z.ZodNumber>;
    sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<["marketCap", "volume24h", "priceChange24h", "createdAt"]>>>;
    sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["asc", "desc"]>>>;
    riskLevel: z.ZodOptional<z.ZodArray<z.ZodEnum<["VERY_LOW", "LOW", "MEDIUM", "HIGH", "VERY_HIGH"]>, "many">>;
    hasLiquidity: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    sortBy: "volume24h" | "marketCap" | "priceChange24h" | "createdAt";
    sortOrder: "asc" | "desc";
    search?: string | undefined;
    chain?: string | undefined;
    minMarketCap?: number | undefined;
    maxMarketCap?: number | undefined;
    minVolume?: number | undefined;
    riskLevel?: ("VERY_LOW" | "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH")[] | undefined;
    hasLiquidity?: boolean | undefined;
}, {
    search?: string | undefined;
    chain?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    minMarketCap?: number | undefined;
    maxMarketCap?: number | undefined;
    minVolume?: number | undefined;
    sortBy?: "volume24h" | "marketCap" | "priceChange24h" | "createdAt" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    riskLevel?: ("VERY_LOW" | "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH")[] | undefined;
    hasLiquidity?: boolean | undefined;
}>;
export declare const createFilterSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    criteria: z.ZodObject<{
        marketCap: z.ZodOptional<z.ZodObject<{
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            max?: number | undefined;
            min?: number | undefined;
        }, {
            max?: number | undefined;
            min?: number | undefined;
        }>>;
        volume24h: z.ZodOptional<z.ZodObject<{
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            max?: number | undefined;
            min?: number | undefined;
        }, {
            max?: number | undefined;
            min?: number | undefined;
        }>>;
        priceChange: z.ZodOptional<z.ZodObject<{
            period: z.ZodEnum<["1h", "24h", "7d"]>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            period: "1h" | "24h" | "7d";
            max?: number | undefined;
            min?: number | undefined;
        }, {
            period: "1h" | "24h" | "7d";
            max?: number | undefined;
            min?: number | undefined;
        }>>;
        safetyScore: z.ZodOptional<z.ZodObject<{
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            max?: number | undefined;
            min?: number | undefined;
        }, {
            max?: number | undefined;
            min?: number | undefined;
        }>>;
        riskLevel: z.ZodOptional<z.ZodArray<z.ZodEnum<["VERY_LOW", "LOW", "MEDIUM", "HIGH", "VERY_HIGH"]>, "many">>;
        liquidity: z.ZodOptional<z.ZodObject<{
            min: z.ZodOptional<z.ZodNumber>;
            required: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            min?: number | undefined;
            required?: boolean | undefined;
        }, {
            min?: number | undefined;
            required?: boolean | undefined;
        }>>;
        holderCount: z.ZodOptional<z.ZodObject<{
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            max?: number | undefined;
            min?: number | undefined;
        }, {
            max?: number | undefined;
            min?: number | undefined;
        }>>;
        contractAge: z.ZodOptional<z.ZodObject<{
            minDays: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            minDays?: number | undefined;
        }, {
            minDays?: number | undefined;
        }>>;
        chain: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        signals: z.ZodOptional<z.ZodObject<{
            types: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            minStrength: z.ZodOptional<z.ZodNumber>;
            minConfidence: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            types?: string[] | undefined;
            minStrength?: number | undefined;
            minConfidence?: number | undefined;
        }, {
            types?: string[] | undefined;
            minStrength?: number | undefined;
            minConfidence?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        chain?: string[] | undefined;
        liquidity?: {
            min?: number | undefined;
            required?: boolean | undefined;
        } | undefined;
        safetyScore?: {
            max?: number | undefined;
            min?: number | undefined;
        } | undefined;
        volume24h?: {
            max?: number | undefined;
            min?: number | undefined;
        } | undefined;
        marketCap?: {
            max?: number | undefined;
            min?: number | undefined;
        } | undefined;
        riskLevel?: ("VERY_LOW" | "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH")[] | undefined;
        priceChange?: {
            period: "1h" | "24h" | "7d";
            max?: number | undefined;
            min?: number | undefined;
        } | undefined;
        holderCount?: {
            max?: number | undefined;
            min?: number | undefined;
        } | undefined;
        contractAge?: {
            minDays?: number | undefined;
        } | undefined;
        signals?: {
            types?: string[] | undefined;
            minStrength?: number | undefined;
            minConfidence?: number | undefined;
        } | undefined;
    }, {
        chain?: string[] | undefined;
        liquidity?: {
            min?: number | undefined;
            required?: boolean | undefined;
        } | undefined;
        safetyScore?: {
            max?: number | undefined;
            min?: number | undefined;
        } | undefined;
        volume24h?: {
            max?: number | undefined;
            min?: number | undefined;
        } | undefined;
        marketCap?: {
            max?: number | undefined;
            min?: number | undefined;
        } | undefined;
        riskLevel?: ("VERY_LOW" | "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH")[] | undefined;
        priceChange?: {
            period: "1h" | "24h" | "7d";
            max?: number | undefined;
            min?: number | undefined;
        } | undefined;
        holderCount?: {
            max?: number | undefined;
            min?: number | undefined;
        } | undefined;
        contractAge?: {
            minDays?: number | undefined;
        } | undefined;
        signals?: {
            types?: string[] | undefined;
            minStrength?: number | undefined;
            minConfidence?: number | undefined;
        } | undefined;
    }>;
    isPublic: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    criteria: {
        chain?: string[] | undefined;
        liquidity?: {
            min?: number | undefined;
            required?: boolean | undefined;
        } | undefined;
        safetyScore?: {
            max?: number | undefined;
            min?: number | undefined;
        } | undefined;
        volume24h?: {
            max?: number | undefined;
            min?: number | undefined;
        } | undefined;
        marketCap?: {
            max?: number | undefined;
            min?: number | undefined;
        } | undefined;
        riskLevel?: ("VERY_LOW" | "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH")[] | undefined;
        priceChange?: {
            period: "1h" | "24h" | "7d";
            max?: number | undefined;
            min?: number | undefined;
        } | undefined;
        holderCount?: {
            max?: number | undefined;
            min?: number | undefined;
        } | undefined;
        contractAge?: {
            minDays?: number | undefined;
        } | undefined;
        signals?: {
            types?: string[] | undefined;
            minStrength?: number | undefined;
            minConfidence?: number | undefined;
        } | undefined;
    };
    isPublic: boolean;
    description?: string | undefined;
}, {
    name: string;
    criteria: {
        chain?: string[] | undefined;
        liquidity?: {
            min?: number | undefined;
            required?: boolean | undefined;
        } | undefined;
        safetyScore?: {
            max?: number | undefined;
            min?: number | undefined;
        } | undefined;
        volume24h?: {
            max?: number | undefined;
            min?: number | undefined;
        } | undefined;
        marketCap?: {
            max?: number | undefined;
            min?: number | undefined;
        } | undefined;
        riskLevel?: ("VERY_LOW" | "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH")[] | undefined;
        priceChange?: {
            period: "1h" | "24h" | "7d";
            max?: number | undefined;
            min?: number | undefined;
        } | undefined;
        holderCount?: {
            max?: number | undefined;
            min?: number | undefined;
        } | undefined;
        contractAge?: {
            minDays?: number | undefined;
        } | undefined;
        signals?: {
            types?: string[] | undefined;
            minStrength?: number | undefined;
            minConfidence?: number | undefined;
        } | undefined;
    };
    description?: string | undefined;
    isPublic?: boolean | undefined;
}>;
export declare const createAlertSchema: z.ZodObject<{
    type: z.ZodEnum<["PRICE_ALERT", "VOLUME_ALERT", "SAFETY_ALERT", "SIGNAL_ALERT", "NEWS_ALERT"]>;
    tokenAddress: z.ZodOptional<z.ZodString>;
    condition: z.ZodObject<{
        metric: z.ZodString;
        operator: z.ZodEnum<["gt", "lt", "gte", "lte", "eq"]>;
        value: z.ZodNumber;
        period: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        value: number;
        metric: string;
        operator: "gt" | "lt" | "gte" | "lte" | "eq";
        period?: string | undefined;
    }, {
        value: number;
        metric: string;
        operator: "gt" | "lt" | "gte" | "lte" | "eq";
        period?: string | undefined;
    }>;
    message: z.ZodOptional<z.ZodString>;
    severity: z.ZodDefault<z.ZodOptional<z.ZodEnum<["LOW", "MEDIUM", "HIGH", "CRITICAL"]>>>;
}, "strip", z.ZodTypeAny, {
    type: "PRICE_ALERT" | "VOLUME_ALERT" | "SAFETY_ALERT" | "SIGNAL_ALERT" | "NEWS_ALERT";
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    condition: {
        value: number;
        metric: string;
        operator: "gt" | "lt" | "gte" | "lte" | "eq";
        period?: string | undefined;
    };
    message?: string | undefined;
    tokenAddress?: string | undefined;
}, {
    type: "PRICE_ALERT" | "VOLUME_ALERT" | "SAFETY_ALERT" | "SIGNAL_ALERT" | "NEWS_ALERT";
    condition: {
        value: number;
        metric: string;
        operator: "gt" | "lt" | "gte" | "lte" | "eq";
        period?: string | undefined;
    };
    message?: string | undefined;
    tokenAddress?: string | undefined;
    severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | undefined;
}>;
export declare const alertsQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    type: z.ZodOptional<z.ZodEnum<["PRICE_ALERT", "VOLUME_ALERT", "SAFETY_ALERT", "SIGNAL_ALERT", "NEWS_ALERT"]>>;
    severity: z.ZodOptional<z.ZodEnum<["LOW", "MEDIUM", "HIGH", "CRITICAL"]>>;
    isRead: z.ZodOptional<z.ZodBoolean>;
    tokenAddress: z.ZodOptional<z.ZodString>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    type?: "PRICE_ALERT" | "VOLUME_ALERT" | "SAFETY_ALERT" | "SIGNAL_ALERT" | "NEWS_ALERT" | undefined;
    tokenAddress?: string | undefined;
    severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | undefined;
    isRead?: boolean | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
}, {
    type?: "PRICE_ALERT" | "VOLUME_ALERT" | "SAFETY_ALERT" | "SIGNAL_ALERT" | "NEWS_ALERT" | undefined;
    tokenAddress?: string | undefined;
    severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    isRead?: boolean | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
}>;
export declare const exportQuerySchema: z.ZodObject<{
    format: z.ZodEnum<["csv", "json", "xlsx"]>;
    filters: z.ZodOptional<z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>>;
    fields: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    format: "csv" | "json" | "xlsx";
    filters?: {} | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
    fields?: string[] | undefined;
}, {
    format: "csv" | "json" | "xlsx";
    filters?: {} | undefined;
    limit?: number | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
    fields?: string[] | undefined;
}>;
export interface ApiError {
    code: string;
    message: string;
    details?: any;
    statusCode: number;
}
export declare const API_ERROR_CODES: {
    readonly VALIDATION_ERROR: "VALIDATION_ERROR";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly UNAUTHORIZED: "UNAUTHORIZED";
    readonly FORBIDDEN: "FORBIDDEN";
    readonly RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
    readonly SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE";
    readonly INVALID_TOKEN: "INVALID_TOKEN";
    readonly FILTER_NOT_FOUND: "FILTER_NOT_FOUND";
    readonly ALERT_NOT_FOUND: "ALERT_NOT_FOUND";
    readonly EXPORT_FAILED: "EXPORT_FAILED";
};
export type ApiErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES];
//# sourceMappingURL=api.types.d.ts.map