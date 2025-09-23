"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsController = void 0;
const zod_1 = require("zod");
const logger_1 = require("../../backend/src/config/logger");
const api_types_1 = require("../types/api.types");
// Analytics query validation schema
const analyticsQuerySchema = zod_1.z.object({
    period: zod_1.z.enum(['1h', '24h', '7d', '30d']).optional().default('24h'),
    chain: zod_1.z.string().optional(),
    category: zod_1.z.string().optional(),
});
// Performance metrics query schema
const performanceQuerySchema = zod_1.z.object({
    period: zod_1.z.enum(['1h', '24h', '7d', '30d']).optional().default('24h'),
    granularity: zod_1.z.enum(['hour', 'day', 'week']).optional().default('hour'),
    limit: zod_1.z.number().min(1).max(1000).optional().default(100),
});
class AnalyticsController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    // GET /api/v1/analytics/summary - Dashboard summary statistics
    async getDashboardSummary(req, res) {
        try {
            const query = analyticsQuerySchema.parse(req.query);
            // Calculate time range based on period
            const now = new Date();
            const timeRange = this.getTimeRange(query.period, now);
            // Get basic counts
            const [totalTokens, totalVolume24h, totalMarketCap, topPerformers, topLosers, riskDistribution, recentActivity, marketTrends] = await Promise.all([
                this.getTotalTokens(query.chain),
                this.getTotalVolume24h(query.chain),
                this.getTotalMarketCap(query.chain),
                this.getTopPerformers(query.chain, 5),
                this.getTopLosers(query.chain, 5),
                this.getRiskDistribution(query.chain),
                this.getRecentActivity(timeRange, query.chain),
                this.getMarketTrends(timeRange, query.chain)
            ]);
            // Count active alerts (mock data for now)
            const activeAlerts = await this.getActiveAlertsCount();
            const summary = {
                totalTokens,
                totalVolume24h,
                totalMarketCap,
                activeAlerts,
                topPerformers,
                topLosers,
                riskDistribution,
                recentActivity,
                marketTrends
            };
            const response = {
                success: true,
                data: summary,
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            };
            res.json(response);
            logger_1.logger.info('Dashboard summary retrieved successfully', {
                period: query.period,
                chain: query.chain,
                totalTokens
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                res.status(400).json({
                    success: false,
                    error: api_types_1.API_ERROR_CODES.VALIDATION_ERROR,
                    message: 'Invalid query parameters',
                    details: error.errors,
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                });
                return;
            }
            logger_1.logger.error('Error fetching dashboard summary:', error);
            res.status(500).json({
                success: false,
                error: api_types_1.API_ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to fetch dashboard summary',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        }
    }
    // GET /api/v1/analytics/market-metrics - Market-wide metrics
    async getMarketMetrics(req, res) {
        try {
            const query = analyticsQuerySchema.parse(req.query);
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            // Get current metrics
            const [totalMarketCap, totalVolume24h, activeTokens, newTokens24h, avgSafetyScore] = await Promise.all([
                this.getTotalMarketCap(query.chain),
                this.getTotalVolume24h(query.chain),
                this.getActiveTokensCount(query.chain),
                this.getNewTokensCount(yesterday, query.chain),
                this.getAverageSafetyScore(query.chain)
            ]);
            // Get 24h change metrics
            const [totalMarketCapYesterday, totalVolumeYesterday] = await Promise.all([
                this.getTotalMarketCapAtDate(yesterday, query.chain),
                this.getTotalVolumeAtDate(yesterday, query.chain)
            ]);
            const marketCapChange24h = totalMarketCapYesterday > 0
                ? ((totalMarketCap - totalMarketCapYesterday) / totalMarketCapYesterday) * 100
                : 0;
            const volumeChange24h = totalVolumeYesterday > 0
                ? ((totalVolume24h - totalVolumeYesterday) / totalVolumeYesterday) * 100
                : 0;
            // Calculate dominance index (simplified)
            const dominanceIndex = await this.calculateDominanceIndex(query.chain);
            const metrics = {
                totalMarketCap,
                totalVolume24h,
                marketCapChange24h,
                volumeChange24h,
                activeTokens,
                newTokens24h,
                avgSafetyScore,
                dominanceIndex
            };
            const response = {
                success: true,
                data: metrics,
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            };
            res.json(response);
            logger_1.logger.info('Market metrics retrieved successfully', {
                period: query.period,
                chain: query.chain
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching market metrics:', error);
            res.status(500).json({
                success: false,
                error: api_types_1.API_ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to fetch market metrics',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        }
    }
    // GET /api/v1/analytics/performance - Performance analytics
    async getPerformanceMetrics(req, res) {
        try {
            const query = performanceQuerySchema.parse(req.query);
            const timeRange = this.getTimeRange(query.period, new Date());
            // Get performance data from database
            const performanceData = await this.getPerformanceData(timeRange, query);
            const response = {
                success: true,
                data: performanceData,
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            };
            res.json(response);
            logger_1.logger.info('Performance metrics retrieved successfully', {
                period: query.period,
                granularity: query.granularity,
                dataPoints: performanceData.length
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching performance metrics:', error);
            res.status(500).json({
                success: false,
                error: api_types_1.API_ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to fetch performance metrics',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        }
    }
    // GET /api/v1/analytics/trends - Market trends analysis
    async getTrends(req, res) {
        try {
            const query = analyticsQuerySchema.parse(req.query);
            const timeRange = this.getTimeRange(query.period, new Date());
            // Get trending data
            const trends = await this.getTrendingData(timeRange, query);
            const response = {
                success: true,
                data: trends,
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            };
            res.json(response);
            logger_1.logger.info('Trends data retrieved successfully', {
                period: query.period,
                chain: query.chain
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching trends:', error);
            res.status(500).json({
                success: false,
                error: api_types_1.API_ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to fetch trends',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        }
    }
    // Helper methods for data aggregation
    async getTotalTokens(chain) {
        const whereClause = chain ? { chain } : {};
        return await this.prisma.token.count({ where: whereClause });
    }
    async getTotalVolume24h(chain) {
        const whereClause = chain ? { token: { chain } } : {};
        const result = await this.prisma.priceData.aggregate({
            where: {
                ...whereClause,
                timestamp: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                }
            },
            _sum: {
                volume24h: true
            }
        });
        return result._sum.volume24h || 0;
    }
    async getTotalMarketCap(chain) {
        const whereClause = chain ? { chain } : {};
        const result = await this.prisma.token.aggregate({
            where: whereClause,
            _sum: {
                marketCap: true
            }
        });
        return result._sum.marketCap || 0;
    }
    async getTotalMarketCapAtDate(date, chain) {
        // This would require historical market cap data
        // For now, return a mock value
        const current = await this.getTotalMarketCap(chain);
        return current * 0.95; // Mock 5% lower yesterday
    }
    async getTotalVolumeAtDate(date, chain) {
        const whereClause = chain ? { token: { chain } } : {};
        const result = await this.prisma.priceData.aggregate({
            where: {
                ...whereClause,
                timestamp: {
                    gte: new Date(date.getTime() - 24 * 60 * 60 * 1000),
                    lte: date
                }
            },
            _sum: {
                volume24h: true
            }
        });
        return result._sum.volume24h || 0;
    }
    async getTopPerformers(chain, limit = 5) {
        const whereClause = chain ? { chain } : {};
        const tokens = await this.prisma.token.findMany({
            where: whereClause,
            include: {
                priceData: {
                    orderBy: { timestamp: 'desc' },
                    take: 1
                }
            },
            take: limit * 2 // Get more to filter and sort
        });
        // Filter tokens with price data and sort by 24h change
        return tokens
            .filter(token => token.priceData[0]?.priceChange24h)
            .sort((a, b) => (b.priceData[0]?.priceChange24h || 0) - (a.priceData[0]?.priceChange24h || 0))
            .slice(0, limit)
            .map(token => this.tokenToResponse(token));
    }
    async getTopLosers(chain, limit = 5) {
        const whereClause = chain ? { chain } : {};
        const tokens = await this.prisma.token.findMany({
            where: whereClause,
            include: {
                priceData: {
                    orderBy: { timestamp: 'desc' },
                    take: 1
                }
            },
            take: limit * 2
        });
        // Filter tokens with price data and sort by 24h change (ascending for losers)
        return tokens
            .filter(token => token.priceData[0]?.priceChange24h)
            .sort((a, b) => (a.priceData[0]?.priceChange24h || 0) - (b.priceData[0]?.priceChange24h || 0))
            .slice(0, limit)
            .map(token => this.tokenToResponse(token));
    }
    async getRiskDistribution(chain) {
        const whereClause = chain ? { token: { chain } } : {};
        const distribution = await this.prisma.safetyScore.groupBy({
            by: ['riskLevel'],
            where: whereClause,
            _count: {
                riskLevel: true
            }
        });
        const result = {
            VERY_LOW: 0,
            LOW: 0,
            MEDIUM: 0,
            HIGH: 0,
            VERY_HIGH: 0
        };
        distribution.forEach(item => {
            if (item.riskLevel in result) {
                result[item.riskLevel] = item._count.riskLevel;
            }
        });
        return result;
    }
    async getRecentActivity(timeRange, chain) {
        const whereClause = chain ? { chain } : {};
        const [newTokens, priceAlerts, volumeSpikes] = await Promise.all([
            this.prisma.token.count({
                where: {
                    ...whereClause,
                    createdAt: {
                        gte: timeRange.start,
                        lte: timeRange.end
                    }
                }
            }),
            // Mock price alerts count
            Promise.resolve(Math.floor(Math.random() * 50)),
            // Mock volume spikes count
            Promise.resolve(Math.floor(Math.random() * 20))
        ]);
        return {
            newTokens,
            priceAlerts,
            volumeSpikes
        };
    }
    async getMarketTrends(timeRange, chain) {
        const whereClause = chain ? { token: { chain } } : {};
        const signals = await this.prisma.tradingSignal.groupBy({
            by: ['action'],
            where: {
                ...whereClause,
                createdAt: {
                    gte: timeRange.start,
                    lte: timeRange.end
                },
                isActive: true
            },
            _count: {
                action: true
            }
        });
        const trends = {
            bullishSignals: 0,
            bearishSignals: 0,
            neutralSignals: 0
        };
        signals.forEach(signal => {
            switch (signal.action) {
                case 'BUY':
                case 'STRONG_BUY':
                    trends.bullishSignals += signal._count.action;
                    break;
                case 'SELL':
                case 'STRONG_SELL':
                    trends.bearishSignals += signal._count.action;
                    break;
                default:
                    trends.neutralSignals += signal._count.action;
                    break;
            }
        });
        return trends;
    }
    async getActiveAlertsCount() {
        // Mock implementation - would connect to alerts system
        return Math.floor(Math.random() * 25);
    }
    async getActiveTokensCount(chain) {
        const whereClause = chain ? { token: { chain } } : {};
        return await this.prisma.priceData.groupBy({
            by: ['tokenAddress'],
            where: {
                ...whereClause,
                timestamp: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                }
            }
        }).then(results => results.length);
    }
    async getNewTokensCount(since, chain) {
        const whereClause = chain ? { chain } : {};
        return await this.prisma.token.count({
            where: {
                ...whereClause,
                createdAt: {
                    gte: since
                }
            }
        });
    }
    async getAverageSafetyScore(chain) {
        const whereClause = chain ? { token: { chain } } : {};
        const result = await this.prisma.safetyScore.aggregate({
            where: whereClause,
            _avg: {
                overallScore: true
            }
        });
        return result._avg.overallScore || 0;
    }
    async calculateDominanceIndex(chain) {
        // Simplified dominance calculation - top 10 tokens by market cap
        const topTokens = await this.prisma.token.findMany({
            where: chain ? { chain } : {},
            orderBy: { marketCap: 'desc' },
            take: 10,
            select: { marketCap: true }
        });
        const totalMarketCap = await this.getTotalMarketCap(chain);
        const top10MarketCap = topTokens.reduce((sum, token) => sum + (token.marketCap || 0), 0);
        return totalMarketCap > 0 ? (top10MarketCap / totalMarketCap) * 100 : 0;
    }
    async getPerformanceData(timeRange, query) {
        // Mock performance data - in real implementation, this would calculate actual performance metrics
        const dataPoints = [];
        const interval = this.getIntervalMs(query.granularity);
        const pointCount = Math.min(query.limit, Math.floor((timeRange.end.getTime() - timeRange.start.getTime()) / interval));
        for (let i = 0; i < pointCount; i++) {
            const timestamp = new Date(timeRange.start.getTime() + i * interval);
            dataPoints.push({
                timestamp: timestamp.toISOString(),
                totalReturns: Math.random() * 200 - 100, // -100% to +100%
                sharpeRatio: Math.random() * 3,
                maxDrawdown: Math.random() * -50, // Negative values
                winRate: Math.random() * 100,
                avgReturnPerTrade: Math.random() * 10 - 5,
                totalTrades: Math.floor(Math.random() * 1000),
                successfulTrades: Math.floor(Math.random() * 600)
            });
        }
        return dataPoints;
    }
    async getTrendingData(timeRange, query) {
        // Mock trending data
        return {
            trendingTokens: [],
            volumeTrends: [],
            priceTrends: [],
            sentimentTrends: []
        };
    }
    getTimeRange(period, now) {
        const end = now;
        let start;
        switch (period) {
            case '1h':
                start = new Date(now.getTime() - 60 * 60 * 1000);
                break;
            case '24h':
                start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            default:
                start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        }
        return { start, end };
    }
    getIntervalMs(granularity) {
        switch (granularity) {
            case 'hour': return 60 * 60 * 1000;
            case 'day': return 24 * 60 * 60 * 1000;
            case 'week': return 7 * 24 * 60 * 60 * 1000;
            default: return 60 * 60 * 1000;
        }
    }
    tokenToResponse(token) {
        // This is a simplified conversion - would use proper typing in real implementation
        const typedToken = token;
        return {
            address: typedToken.address,
            symbol: typedToken.symbol,
            name: typedToken.name,
            decimals: typedToken.decimals,
            chain: typedToken.chain,
            totalSupply: '0',
            circulatingSupply: '0'
        };
    }
}
exports.AnalyticsController = AnalyticsController;
//# sourceMappingURL=analytics.controller.js.map