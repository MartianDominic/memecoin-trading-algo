// API Types and Interfaces for Frontend Dashboard
import { z } from 'zod';
import { TokenData, PriceInfo, SafetyAnalysis, TradingSignal } from '../../backend/src/types';

// Request/Response Types
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

// Token API Types
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

// Filter API Types
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

// Alert API Types
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

// Analytics API Types
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

// Export API Types
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

// WebSocket Types
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

// Validation Schemas
export const tokenListQuerySchema = z.object({
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(20),
  search: z.string().optional(),
  chain: z.string().optional(),
  minMarketCap: z.number().min(0).optional(),
  maxMarketCap: z.number().min(0).optional(),
  minVolume: z.number().min(0).optional(),
  sortBy: z.enum(['marketCap', 'volume24h', 'priceChange24h', 'createdAt']).optional().default('marketCap'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  riskLevel: z.array(z.enum(['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'])).optional(),
  hasLiquidity: z.boolean().optional(),
});

export const createFilterSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  criteria: z.object({
    marketCap: z.object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
    }).optional(),
    volume24h: z.object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
    }).optional(),
    priceChange: z.object({
      period: z.enum(['1h', '24h', '7d']),
      min: z.number().optional(),
      max: z.number().optional(),
    }).optional(),
    safetyScore: z.object({
      min: z.number().min(0).max(10).optional(),
      max: z.number().min(0).max(10).optional(),
    }).optional(),
    riskLevel: z.array(z.enum(['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'])).optional(),
    liquidity: z.object({
      min: z.number().min(0).optional(),
      required: z.boolean().optional(),
    }).optional(),
    holderCount: z.object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
    }).optional(),
    contractAge: z.object({
      minDays: z.number().min(0).optional(),
    }).optional(),
    chain: z.array(z.string()).optional(),
    signals: z.object({
      types: z.array(z.string()).optional(),
      minStrength: z.number().min(0).max(1).optional(),
      minConfidence: z.number().min(0).max(1).optional(),
    }).optional(),
  }),
  isPublic: z.boolean().optional().default(false),
});

export const createAlertSchema = z.object({
  type: z.enum(['PRICE_ALERT', 'VOLUME_ALERT', 'SAFETY_ALERT', 'SIGNAL_ALERT', 'NEWS_ALERT']),
  tokenAddress: z.string().optional(),
  condition: z.object({
    metric: z.string(),
    operator: z.enum(['gt', 'lt', 'gte', 'lte', 'eq']),
    value: z.number(),
    period: z.string().optional(),
  }),
  message: z.string().max(500).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('MEDIUM'),
});

export const alertsQuerySchema = z.object({
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(20),
  type: z.enum(['PRICE_ALERT', 'VOLUME_ALERT', 'SAFETY_ALERT', 'SIGNAL_ALERT', 'NEWS_ALERT']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  isRead: z.boolean().optional(),
  tokenAddress: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const exportQuerySchema = z.object({
  format: z.enum(['csv', 'json', 'xlsx']),
  filters: z.object({}).optional(), // Will be detailed based on FilterCriteria
  fields: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.number().min(1).max(10000).optional().default(1000),
});

// Error Types
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  statusCode: number;
}

export const API_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INVALID_TOKEN: 'INVALID_TOKEN',
  FILTER_NOT_FOUND: 'FILTER_NOT_FOUND',
  ALERT_NOT_FOUND: 'ALERT_NOT_FOUND',
  EXPORT_FAILED: 'EXPORT_FAILED',
} as const;

export type ApiErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES];