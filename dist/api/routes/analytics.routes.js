"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAnalyticsRoutes = createAnalyticsRoutes;
// Analytics Routes - REST endpoints for dashboard metrics and analytics
const express_1 = require("express");
const validation_middleware_1 = require("../middleware/validation.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
const zod_1 = require("zod");
// Validation schemas for analytics routes
const analyticsQuerySchema = zod_1.z.object({
    period: zod_1.z.enum(['1h', '24h', '7d', '30d']).optional().default('24h'),
    chain: zod_1.z.string().optional(),
    category: zod_1.z.string().optional(),
});
const performanceQuerySchema = zod_1.z.object({
    period: zod_1.z.enum(['1h', '24h', '7d', '30d']).optional().default('24h'),
    granularity: zod_1.z.enum(['hour', 'day', 'week']).optional().default('hour'),
    limit: zod_1.z.string().transform(val => parseInt(val, 10)).pipe(zod_1.z.number().min(1).max(1000)).optional().default(100),
});
const trendsQuerySchema = zod_1.z.object({
    period: zod_1.z.enum(['1h', '24h', '7d', '30d']).optional().default('24h'),
    metric: zod_1.z.enum(['price', 'volume', 'market_cap', 'signals']).optional(),
    chain: zod_1.z.string().optional(),
    limit: zod_1.z.string().transform(val => parseInt(val, 10)).pipe(zod_1.z.number().min(1).max(100)).optional().default(20)
});
function createAnalyticsRoutes(analyticsController) {
    const router = (0, express_1.Router)();
    // GET /api/v1/analytics/summary - Dashboard summary statistics
    router.get('/summary', (0, validation_middleware_1.validate)(analyticsQuerySchema, 'query'), (0, error_middleware_1.asyncHandler)(analyticsController.getDashboardSummary.bind(analyticsController)));
    // GET /api/v1/analytics/market-metrics - Market-wide metrics
    router.get('/market-metrics', (0, validation_middleware_1.validate)(analyticsQuerySchema, 'query'), (0, error_middleware_1.asyncHandler)(analyticsController.getMarketMetrics.bind(analyticsController)));
    // GET /api/v1/analytics/performance - Performance analytics (requires premium)
    router.get('/performance', (0, auth_middleware_1.requireTier)('premium'), (0, validation_middleware_1.validate)(performanceQuerySchema, 'query'), (0, error_middleware_1.asyncHandler)(analyticsController.getPerformanceMetrics.bind(analyticsController)));
    // GET /api/v1/analytics/trends - Market trends analysis
    router.get('/trends', (0, validation_middleware_1.validate)(trendsQuerySchema, 'query'), (0, error_middleware_1.asyncHandler)(analyticsController.getTrends.bind(analyticsController)));
    // GET /api/v1/analytics/top-movers - Top price movers
    router.get('/top-movers', (0, validation_middleware_1.validate)(zod_1.z.object({
        period: zod_1.z.enum(['1h', '24h', '7d']).optional().default('24h'),
        direction: zod_1.z.enum(['gainers', 'losers', 'both']).optional().default('both'),
        limit: zod_1.z.string().transform(val => parseInt(val, 10)).pipe(zod_1.z.number().min(1).max(50)).optional().default(10),
        chain: zod_1.z.string().optional()
    }), 'query'), (0, error_middleware_1.asyncHandler)(async (req, res) => {
        // Mock top movers endpoint
        const { period, direction, limit, chain } = req.query;
        const mockData = {
            gainers: Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
                address: `gainer_${i + 1}`,
                symbol: `GAIN${i + 1}`,
                name: `Gainer Token ${i + 1}`,
                priceChange: Math.random() * 500 + 50, // 50% to 550% gains
                currentPrice: Math.random() * 0.1,
                volume24h: Math.random() * 1000000
            })),
            losers: Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
                address: `loser_${i + 1}`,
                symbol: `LOSE${i + 1}`,
                name: `Loser Token ${i + 1}`,
                priceChange: -(Math.random() * 80 + 10), // -10% to -90% losses
                currentPrice: Math.random() * 0.1,
                volume24h: Math.random() * 1000000
            }))
        };
        let responseData;
        if (direction === 'gainers') {
            responseData = { gainers: mockData.gainers };
        }
        else if (direction === 'losers') {
            responseData = { losers: mockData.losers };
        }
        else {
            responseData = mockData;
        }
        res.json({
            success: true,
            data: responseData,
            metadata: {
                period,
                chain: chain || 'all',
                generatedAt: new Date().toISOString()
            },
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    }));
    // GET /api/v1/analytics/volume-leaders - Top volume leaders
    router.get('/volume-leaders', (0, validation_middleware_1.validate)(zod_1.z.object({
        period: zod_1.z.enum(['1h', '24h', '7d']).optional().default('24h'),
        limit: zod_1.z.string().transform(val => parseInt(val, 10)).pipe(zod_1.z.number().min(1).max(50)).optional().default(10),
        chain: zod_1.z.string().optional()
    }), 'query'), (0, error_middleware_1.asyncHandler)(async (req, res) => {
        // Mock volume leaders
        const { period, limit, chain } = req.query;
        const volumeLeaders = Array.from({ length: limit }, (_, i) => ({
            address: `volume_leader_${i + 1}`,
            symbol: `VOL${i + 1}`,
            name: `Volume Leader ${i + 1}`,
            volume24h: Math.random() * 10000000 + 1000000, // $1M to $11M
            volumeChange24h: (Math.random() - 0.5) * 1000, // -500% to +500%
            currentPrice: Math.random() * 1,
            marketCap: Math.random() * 100000000
        }));
        res.json({
            success: true,
            data: volumeLeaders,
            metadata: {
                period,
                chain: chain || 'all',
                totalVolume: volumeLeaders.reduce((sum, token) => sum + token.volume24h, 0)
            },
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    }));
    // GET /api/v1/analytics/risk-analysis - Risk distribution analysis (requires premium)
    router.get('/risk-analysis', (0, auth_middleware_1.requireTier)('premium'), (0, validation_middleware_1.validate)(zod_1.z.object({
        period: zod_1.z.enum(['24h', '7d', '30d']).optional().default('24h'),
        granularity: zod_1.z.enum(['hour', 'day']).optional().default('day'),
        chain: zod_1.z.string().optional()
    }), 'query'), (0, error_middleware_1.asyncHandler)(async (req, res) => {
        // Mock risk analysis
        const riskAnalysis = {
            currentDistribution: {
                VERY_LOW: 15,
                LOW: 25,
                MEDIUM: 35,
                HIGH: 20,
                VERY_HIGH: 5
            },
            trends: {
                improvingTokens: 12,
                deterioratingTokens: 8,
                stableTokens: 80
            },
            riskFactors: [
                { factor: 'Liquidity Risk', prevalence: 35, trend: 'decreasing' },
                { factor: 'Smart Contract Risk', prevalence: 20, trend: 'stable' },
                { factor: 'Team Risk', prevalence: 15, trend: 'increasing' },
                { factor: 'Market Risk', prevalence: 30, trend: 'stable' }
            ],
            recommendations: [
                'Monitor tokens with declining safety scores',
                'Diversify across risk levels',
                'Avoid tokens with multiple high-risk factors'
            ]
        };
        res.json({
            success: true,
            data: riskAnalysis,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    }));
    // GET /api/v1/analytics/signals-overview - Trading signals overview
    router.get('/signals-overview', (0, validation_middleware_1.validate)(zod_1.z.object({
        period: zod_1.z.enum(['1h', '24h', '7d']).optional().default('24h'),
        signalType: zod_1.z.enum(['BUY', 'SELL', 'HOLD', 'STRONG_BUY', 'STRONG_SELL']).optional(),
        chain: zod_1.z.string().optional()
    }), 'query'), (0, error_middleware_1.asyncHandler)(async (req, res) => {
        // Mock signals overview
        const signalsOverview = {
            totalSignals: 456,
            signalBreakdown: {
                BUY: 120,
                STRONG_BUY: 45,
                SELL: 89,
                STRONG_SELL: 23,
                HOLD: 179
            },
            accuracy: {
                overall: 76.5,
                byType: {
                    BUY: 78.2,
                    STRONG_BUY: 82.1,
                    SELL: 74.8,
                    STRONG_SELL: 79.5,
                    HOLD: 71.3
                }
            },
            topPerformingSignals: [
                {
                    tokenAddress: 'top_signal_1',
                    symbol: 'TOPSIG1',
                    signalType: 'STRONG_BUY',
                    strength: 0.95,
                    confidence: 0.89,
                    performance: 145.2 // % return
                }
            ],
            recentSignals: []
        };
        res.json({
            success: true,
            data: signalsOverview,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    }));
    // GET /api/v1/analytics/correlation - Token correlation analysis (requires enterprise)
    router.get('/correlation', (0, auth_middleware_1.requireTier)('enterprise'), (0, validation_middleware_1.validate)(zod_1.z.object({
        token1: zod_1.z.string().min(1, 'First token address required'),
        token2: zod_1.z.string().min(1, 'Second token address required'),
        period: zod_1.z.enum(['24h', '7d', '30d']).optional().default('7d'),
        metric: zod_1.z.enum(['price', 'volume', 'market_cap']).optional().default('price')
    }), 'query'), (0, error_middleware_1.asyncHandler)(async (req, res) => {
        // Mock correlation analysis
        const correlation = {
            correlation_coefficient: Math.random() * 2 - 1, // -1 to 1
            p_value: Math.random() * 0.1,
            strength: 'moderate', // weak, moderate, strong
            direction: Math.random() > 0.5 ? 'positive' : 'negative',
            data_points: 168, // hours in 7 days
            period: req.query.period,
            metric: req.query.metric
        };
        res.json({
            success: true,
            data: correlation,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    }));
    return router;
}
//# sourceMappingURL=analytics.routes.js.map