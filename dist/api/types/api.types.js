"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.API_ERROR_CODES = exports.exportQuerySchema = exports.alertsQuerySchema = exports.createAlertSchema = exports.createFilterSchema = exports.tokenListQuerySchema = void 0;
// API Types and Interfaces for Frontend Dashboard
const zod_1 = require("zod");
// Validation Schemas
exports.tokenListQuerySchema = zod_1.z.object({
    page: zod_1.z.number().min(1).optional().default(1),
    limit: zod_1.z.number().min(1).max(100).optional().default(20),
    search: zod_1.z.string().optional(),
    chain: zod_1.z.string().optional(),
    minMarketCap: zod_1.z.number().min(0).optional(),
    maxMarketCap: zod_1.z.number().min(0).optional(),
    minVolume: zod_1.z.number().min(0).optional(),
    sortBy: zod_1.z.enum(['marketCap', 'volume24h', 'priceChange24h', 'createdAt']).optional().default('marketCap'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('desc'),
    riskLevel: zod_1.z.array(zod_1.z.enum(['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'])).optional(),
    hasLiquidity: zod_1.z.boolean().optional(),
});
exports.createFilterSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().max(500).optional(),
    criteria: zod_1.z.object({
        marketCap: zod_1.z.object({
            min: zod_1.z.number().min(0).optional(),
            max: zod_1.z.number().min(0).optional(),
        }).optional(),
        volume24h: zod_1.z.object({
            min: zod_1.z.number().min(0).optional(),
            max: zod_1.z.number().min(0).optional(),
        }).optional(),
        priceChange: zod_1.z.object({
            period: zod_1.z.enum(['1h', '24h', '7d']),
            min: zod_1.z.number().optional(),
            max: zod_1.z.number().optional(),
        }).optional(),
        safetyScore: zod_1.z.object({
            min: zod_1.z.number().min(0).max(10).optional(),
            max: zod_1.z.number().min(0).max(10).optional(),
        }).optional(),
        riskLevel: zod_1.z.array(zod_1.z.enum(['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'])).optional(),
        liquidity: zod_1.z.object({
            min: zod_1.z.number().min(0).optional(),
            required: zod_1.z.boolean().optional(),
        }).optional(),
        holderCount: zod_1.z.object({
            min: zod_1.z.number().min(0).optional(),
            max: zod_1.z.number().min(0).optional(),
        }).optional(),
        contractAge: zod_1.z.object({
            minDays: zod_1.z.number().min(0).optional(),
        }).optional(),
        chain: zod_1.z.array(zod_1.z.string()).optional(),
        signals: zod_1.z.object({
            types: zod_1.z.array(zod_1.z.string()).optional(),
            minStrength: zod_1.z.number().min(0).max(1).optional(),
            minConfidence: zod_1.z.number().min(0).max(1).optional(),
        }).optional(),
    }),
    isPublic: zod_1.z.boolean().optional().default(false),
});
exports.createAlertSchema = zod_1.z.object({
    type: zod_1.z.enum(['PRICE_ALERT', 'VOLUME_ALERT', 'SAFETY_ALERT', 'SIGNAL_ALERT', 'NEWS_ALERT']),
    tokenAddress: zod_1.z.string().optional(),
    condition: zod_1.z.object({
        metric: zod_1.z.string(),
        operator: zod_1.z.enum(['gt', 'lt', 'gte', 'lte', 'eq']),
        value: zod_1.z.number(),
        period: zod_1.z.string().optional(),
    }),
    message: zod_1.z.string().max(500).optional(),
    severity: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('MEDIUM'),
});
exports.alertsQuerySchema = zod_1.z.object({
    page: zod_1.z.number().min(1).optional().default(1),
    limit: zod_1.z.number().min(1).max(100).optional().default(20),
    type: zod_1.z.enum(['PRICE_ALERT', 'VOLUME_ALERT', 'SAFETY_ALERT', 'SIGNAL_ALERT', 'NEWS_ALERT']).optional(),
    severity: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    isRead: zod_1.z.boolean().optional(),
    tokenAddress: zod_1.z.string().optional(),
    startDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional(),
});
exports.exportQuerySchema = zod_1.z.object({
    format: zod_1.z.enum(['csv', 'json', 'xlsx']),
    filters: zod_1.z.object({}).optional(), // Will be detailed based on FilterCriteria
    fields: zod_1.z.array(zod_1.z.string()).optional(),
    startDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional(),
    limit: zod_1.z.number().min(1).max(10000).optional().default(1000),
});
exports.API_ERROR_CODES = {
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
};
//# sourceMappingURL=api.types.js.map