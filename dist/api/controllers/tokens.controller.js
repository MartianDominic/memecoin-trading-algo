"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokensController = void 0;
const zod_1 = require("zod");
const logger_1 = require("../../utils/logger");
const logger = logger_1.Logger.getInstance();
const api_types_1 = require("../types/api.types");
class TokensController {
    constructor(prisma, wsManager) {
        this.prisma = prisma;
        this.wsManager = wsManager;
    }
    // GET /api/v1/tokens - List tokens with pagination and filters
    async listTokens(req, res) {
        try {
            // Validate query parameters
            const query = api_types_1.tokenListQuerySchema.parse(req.query);
            // Build where clause from filters
            const whereClause = {};
            if (query.search) {
                whereClause.OR = [
                    { symbol: { contains: query.search, mode: 'insensitive' } },
                    { name: { contains: query.search, mode: 'insensitive' } },
                    { address: { contains: query.search, mode: 'insensitive' } }
                ];
            }
            if (query.chain) {
                whereClause.chain = query.chain;
            }
            if (query.minMarketCap || query.maxMarketCap) {
                whereClause.marketCap = {};
                if (query.minMarketCap)
                    whereClause.marketCap.gte = query.minMarketCap;
                if (query.maxMarketCap)
                    whereClause.marketCap.lte = query.maxMarketCap;
            }
            if (query.hasLiquidity !== undefined) {
                whereClause.safetyScores = {
                    some: {
                        hasLiquidity: query.hasLiquidity
                    }
                };
            }
            if (query.riskLevel && query.riskLevel.length > 0) {
                whereClause.safetyScores = {
                    some: {
                        riskLevel: { in: query.riskLevel }
                    }
                };
            }
            // Calculate pagination
            const skip = (query.page - 1) * query.limit;
            // Get total count for pagination
            const total = await this.prisma.token.count({ where: whereClause });
            // Fetch tokens with related data
            const tokens = await this.prisma.token.findMany({
                where: whereClause,
                include: {
                    priceData: {
                        orderBy: { timestamp: 'desc' },
                        take: 1
                    },
                    safetyScores: {
                        orderBy: { analyzedAt: 'desc' },
                        take: 1
                    },
                    tradingSignals: {
                        where: { isActive: true },
                        orderBy: { createdAt: 'desc' },
                        take: 5
                    }
                },
                orderBy: this.buildOrderBy(query.sortBy, query.sortOrder),
                skip,
                take: query.limit
            });
            // Transform to API response format
            const tokenResponses = tokens.map(token => ({
                address: token.address,
                symbol: token.symbol,
                name: token.name,
                decimals: token.decimals,
                chain: token.chain,
                description: token.description || undefined,
                logoUrl: token.logoUrl || undefined,
                website: token.website || undefined,
                twitter: token.twitter || undefined,
                telegram: token.telegram || undefined,
                marketCap: token.marketCap || undefined,
                totalSupply: token.totalSupply,
                circulatingSupply: token.circulatingSupply,
                launchDate: token.launchDate || undefined,
                currentPrice: token.priceData[0] ? {
                    price: token.priceData[0].price,
                    priceChange1h: token.priceData[0].priceChange1h || undefined,
                    priceChange24h: token.priceData[0].priceChange24h || undefined,
                    priceChange7d: token.priceData[0].priceChange7d || undefined,
                    volume24h: token.priceData[0].volume24h || undefined,
                    volumeChange24h: token.priceData[0].volumeChange24h || undefined,
                    liquidity: token.priceData[0].liquidity || undefined,
                    liquidityChange24h: token.priceData[0].liquidityChange24h || undefined,
                    marketCap: token.priceData[0].marketCap || undefined,
                    fdv: token.priceData[0].fdv || undefined,
                    timestamp: token.priceData[0].timestamp,
                    source: token.priceData[0].source
                } : undefined,
                safetyScore: token.safetyScores[0] ? {
                    overallScore: token.safetyScores[0].overallScore,
                    riskLevel: token.safetyScores[0].riskLevel,
                    liquidityScore: token.safetyScores[0].liquidityScore || undefined,
                    holderScore: token.safetyScores[0].holderScore || undefined,
                    contractScore: token.safetyScores[0].contractScore || undefined,
                    teamScore: token.safetyScores[0].teamScore || undefined,
                    socialScore: token.safetyScores[0].socialScore || undefined,
                    isHoneypot: token.safetyScores[0].isHoneypot,
                    hasRenounced: token.safetyScores[0].hasRenounced,
                    hasLiquidity: token.safetyScores[0].hasLiquidity,
                    hasVerifiedContract: token.safetyScores[0].hasVerifiedContract,
                    holderCount: token.safetyScores[0].holderCount || undefined,
                    topHolderPercent: token.safetyScores[0].topHolderPercent || undefined,
                    contractAge: token.safetyScores[0].contractAge || undefined,
                    mintAuthority: token.safetyScores[0].mintAuthority || undefined,
                    freezeAuthority: token.safetyScores[0].freezeAuthority || undefined,
                    source: token.safetyScores[0].source
                } : undefined,
                activeSignals: token.tradingSignals.map(signal => ({
                    signalType: signal.signalType,
                    strength: signal.strength,
                    confidence: signal.confidence,
                    action: signal.action,
                    entryPrice: signal.entryPrice || undefined,
                    targetPrice: signal.targetPrice || undefined,
                    stopLoss: signal.stopLoss || undefined,
                    indicators: signal.indicators,
                    reasoning: signal.reasoning || undefined,
                    isActive: signal.isActive,
                    expiresAt: signal.expiresAt || undefined
                }))
            }));
            const response = {
                success: true,
                data: tokenResponses,
                pagination: {
                    page: query.page,
                    limit: query.limit,
                    total,
                    totalPages: Math.ceil(total / query.limit),
                    hasNext: skip + query.limit < total,
                    hasPrev: query.page > 1
                },
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            };
            res.json(response);
            logger.info('Tokens listed successfully', {
                count: tokens.length,
                total,
                page: query.page,
                filters: query
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
            logger.error('Error listing tokens:', error);
            res.status(500).json({
                success: false,
                error: api_types_1.API_ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to fetch tokens',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        }
    }
    // GET /api/v1/tokens/:address - Get specific token details
    async getToken(req, res) {
        try {
            const { address } = req.params;
            if (!address) {
                res.status(400).json({
                    success: false,
                    error: api_types_1.API_ERROR_CODES.VALIDATION_ERROR,
                    message: 'Token address is required',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                });
                return;
            }
            const token = await this.prisma.token.findUnique({
                where: { address },
                include: {
                    priceData: {
                        orderBy: { timestamp: 'desc' },
                        take: 30 // Last 30 price updates for charts
                    },
                    safetyScores: {
                        orderBy: { analyzedAt: 'desc' },
                        take: 1
                    },
                    tradingSignals: {
                        where: { isActive: true },
                        orderBy: { createdAt: 'desc' }
                    }
                }
            });
            if (!token) {
                res.status(404).json({
                    success: false,
                    error: api_types_1.API_ERROR_CODES.NOT_FOUND,
                    message: 'Token not found',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                });
                return;
            }
            // Calculate performance metrics
            const performance = this.calculatePerformanceMetrics(token.priceData);
            const tokenResponse = {
                address: token.address,
                symbol: token.symbol,
                name: token.name,
                decimals: token.decimals,
                chain: token.chain,
                description: token.description || undefined,
                logoUrl: token.logoUrl || undefined,
                website: token.website || undefined,
                twitter: token.twitter || undefined,
                telegram: token.telegram || undefined,
                marketCap: token.marketCap || undefined,
                totalSupply: token.totalSupply,
                circulatingSupply: token.circulatingSupply,
                launchDate: token.launchDate || undefined,
                currentPrice: token.priceData[0] ? {
                    price: token.priceData[0].price,
                    priceChange1h: token.priceData[0].priceChange1h || undefined,
                    priceChange24h: token.priceData[0].priceChange24h || undefined,
                    priceChange7d: token.priceData[0].priceChange7d || undefined,
                    volume24h: token.priceData[0].volume24h || undefined,
                    volumeChange24h: token.priceData[0].volumeChange24h || undefined,
                    liquidity: token.priceData[0].liquidity || undefined,
                    liquidityChange24h: token.priceData[0].liquidityChange24h || undefined,
                    marketCap: token.priceData[0].marketCap || undefined,
                    fdv: token.priceData[0].fdv || undefined,
                    timestamp: token.priceData[0].timestamp,
                    source: token.priceData[0].source
                } : undefined,
                safetyScore: token.safetyScores[0] ? {
                    overallScore: token.safetyScores[0].overallScore,
                    riskLevel: token.safetyScores[0].riskLevel,
                    liquidityScore: token.safetyScores[0].liquidityScore || undefined,
                    holderScore: token.safetyScores[0].holderScore || undefined,
                    contractScore: token.safetyScores[0].contractScore || undefined,
                    teamScore: token.safetyScores[0].teamScore || undefined,
                    socialScore: token.safetyScores[0].socialScore || undefined,
                    isHoneypot: token.safetyScores[0].isHoneypot,
                    hasRenounced: token.safetyScores[0].hasRenounced,
                    hasLiquidity: token.safetyScores[0].hasLiquidity,
                    hasVerifiedContract: token.safetyScores[0].hasVerifiedContract,
                    holderCount: token.safetyScores[0].holderCount || undefined,
                    topHolderPercent: token.safetyScores[0].topHolderPercent || undefined,
                    contractAge: token.safetyScores[0].contractAge || undefined,
                    mintAuthority: token.safetyScores[0].mintAuthority || undefined,
                    freezeAuthority: token.safetyScores[0].freezeAuthority || undefined,
                    source: token.safetyScores[0].source
                } : undefined,
                activeSignals: token.tradingSignals.map(signal => ({
                    signalType: signal.signalType,
                    strength: signal.strength,
                    confidence: signal.confidence,
                    action: signal.action,
                    entryPrice: signal.entryPrice || undefined,
                    targetPrice: signal.targetPrice || undefined,
                    stopLoss: signal.stopLoss || undefined,
                    indicators: signal.indicators,
                    reasoning: signal.reasoning || undefined,
                    isActive: signal.isActive,
                    expiresAt: signal.expiresAt || undefined
                })),
                performance
            };
            const response = {
                success: true,
                data: tokenResponse,
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            };
            res.json(response);
            logger.info('Token details retrieved successfully', {
                address,
                symbol: token.symbol
            });
        }
        catch (error) {
            logger.error('Error fetching token details:', error);
            res.status(500).json({
                success: false,
                error: api_types_1.API_ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to fetch token details',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        }
    }
    // POST /api/v1/tokens - Create/update token (for data pipeline)
    async createOrUpdateToken(req, res) {
        try {
            const tokenData = req.body;
            // Validate required fields
            if (!tokenData.address || !tokenData.symbol || !tokenData.name) {
                res.status(400).json({
                    success: false,
                    error: api_types_1.API_ERROR_CODES.VALIDATION_ERROR,
                    message: 'Address, symbol, and name are required',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                });
                return;
            }
            const token = await this.prisma.token.upsert({
                where: { address: tokenData.address },
                update: {
                    symbol: tokenData.symbol,
                    name: tokenData.name,
                    decimals: tokenData.decimals || 9,
                    chain: tokenData.chain || 'solana',
                    description: tokenData.description,
                    logoUrl: tokenData.logoUrl,
                    website: tokenData.website,
                    twitter: tokenData.twitter,
                    telegram: tokenData.telegram,
                    marketCap: tokenData.marketCap,
                    totalSupply: tokenData.totalSupply,
                    circulatingSupply: tokenData.circulatingSupply,
                    launchDate: tokenData.launchDate ? new Date(tokenData.launchDate) : undefined,
                    updatedAt: new Date()
                },
                create: {
                    address: tokenData.address,
                    symbol: tokenData.symbol,
                    name: tokenData.name,
                    decimals: tokenData.decimals || 9,
                    chain: tokenData.chain || 'solana',
                    description: tokenData.description,
                    logoUrl: tokenData.logoUrl,
                    website: tokenData.website,
                    twitter: tokenData.twitter,
                    telegram: tokenData.telegram,
                    marketCap: tokenData.marketCap,
                    totalSupply: tokenData.totalSupply,
                    circulatingSupply: tokenData.circulatingSupply,
                    launchDate: tokenData.launchDate ? new Date(tokenData.launchDate) : undefined
                }
            });
            // Broadcast update via WebSocket
            this.wsManager.broadcastTokenUpdate(token.address, {
                type: 'TOKEN_UPDATE',
                payload: { token },
                timestamp: new Date().toISOString()
            });
            const response = {
                success: true,
                data: { id: token.id, address: token.address },
                message: 'Token created/updated successfully',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            };
            res.status(201).json(response);
            logger.info('Token created/updated successfully', {
                address: token.address,
                symbol: token.symbol
            });
        }
        catch (error) {
            logger.error('Error creating/updating token:', error);
            res.status(500).json({
                success: false,
                error: api_types_1.API_ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to create/update token',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        }
    }
    buildOrderBy(sortBy, sortOrder) {
        const orderBy = {};
        switch (sortBy) {
            case 'marketCap':
                orderBy.marketCap = sortOrder;
                break;
            case 'volume24h':
                orderBy.priceData = {
                    _count: 'desc' // This is a simplified approach
                };
                break;
            case 'priceChange24h':
                orderBy.priceData = {
                    _count: 'desc' // This is a simplified approach
                };
                break;
            case 'createdAt':
            default:
                orderBy.createdAt = sortOrder;
                break;
        }
        return orderBy;
    }
    calculatePerformanceMetrics(priceData) {
        if (!priceData || priceData.length < 2) {
            return undefined;
        }
        const sortedPrices = priceData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const currentPrice = sortedPrices[sortedPrices.length - 1]?.price || 0;
        // Calculate ROI for different periods
        const roi24h = this.calculateROI(sortedPrices, 24 * 60 * 60 * 1000); // 24 hours
        const roi7d = this.calculateROI(sortedPrices, 7 * 24 * 60 * 60 * 1000); // 7 days
        const roi30d = this.calculateROI(sortedPrices, 30 * 24 * 60 * 60 * 1000); // 30 days
        // Calculate volatility (standard deviation of returns)
        const volatility = this.calculateVolatility(sortedPrices);
        // Calculate Sharpe ratio (simplified, assuming 0% risk-free rate)
        const averageReturn = (roi24h || 0) / 24; // Hourly average
        const sharpeRatio = volatility > 0 ? averageReturn / volatility : 0;
        return {
            roi24h,
            roi7d,
            roi30d,
            volatility,
            sharpeRatio
        };
    }
    calculateROI(prices, periodMs) {
        if (prices.length < 2)
            return undefined;
        const now = new Date().getTime();
        const periodStart = now - periodMs;
        const currentPrice = prices[prices.length - 1]?.price;
        const historicalPrice = prices.find(p => new Date(p.timestamp).getTime() >= periodStart)?.price;
        if (!currentPrice || !historicalPrice)
            return undefined;
        return ((currentPrice - historicalPrice) / historicalPrice) * 100;
    }
    calculateVolatility(prices) {
        if (prices.length < 2)
            return 0;
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            const currentPrice = prices[i].price;
            const previousPrice = prices[i - 1].price;
            if (previousPrice > 0) {
                returns.push((currentPrice - previousPrice) / previousPrice);
            }
        }
        if (returns.length === 0)
            return 0;
        const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
        return Math.sqrt(variance) * 100; // Convert to percentage
    }
}
exports.TokensController = TokensController;
//# sourceMappingURL=tokens.controller.js.map