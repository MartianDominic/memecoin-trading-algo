"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FiltersController = void 0;
const zod_1 = require("zod");
const logger_1 = require("../../backend/src/config/logger");
const api_types_1 = require("../types/api.types");
// In-memory filter storage (in production, use database)
class FilterStorage {
    constructor() {
        this.filters = new Map();
        this.filterResults = new Map();
    }
    createFilter(filter) {
        this.filters.set(filter.id, filter);
    }
    getFilter(id) {
        return this.filters.get(id);
    }
    listFilters(userId) {
        return Array.from(this.filters.values()).filter(filter => filter.isPublic || filter.userId === userId);
    }
    updateFilter(id, updates) {
        const filter = this.filters.get(id);
        if (!filter)
            return undefined;
        const updatedFilter = { ...filter, ...updates, updatedAt: new Date().toISOString() };
        this.filters.set(id, updatedFilter);
        return updatedFilter;
    }
    deleteFilter(id) {
        return this.filters.delete(id);
    }
    cacheFilterResults(filterId, results) {
        this.filterResults.set(filterId, {
            results,
            timestamp: new Date()
        });
    }
    getCachedResults(filterId, maxAgeMs = 5 * 60 * 1000) {
        const cached = this.filterResults.get(filterId);
        if (!cached)
            return undefined;
        const age = Date.now() - cached.timestamp.getTime();
        if (age > maxAgeMs) {
            this.filterResults.delete(filterId);
            return undefined;
        }
        return cached.results;
    }
}
class FiltersController {
    constructor(prisma, wsManager) {
        this.prisma = prisma;
        this.wsManager = wsManager;
        this.filterStorage = new FilterStorage();
    }
    // GET /api/v1/filters - List user filters
    async listFilters(req, res) {
        try {
            const { page = 1, limit = 20, userId, isPublic } = req.query;
            const pageNum = parseInt(page);
            const limitNum = Math.min(parseInt(limit), 100);
            let filters = this.filterStorage.listFilters(userId);
            if (isPublic !== undefined) {
                const isPublicBool = isPublic === 'true';
                filters = filters.filter(filter => filter.isPublic === isPublicBool);
            }
            // Apply pagination
            const total = filters.length;
            const skip = (pageNum - 1) * limitNum;
            const paginatedFilters = filters.slice(skip, skip + limitNum);
            const response = {
                success: true,
                data: paginatedFilters,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum),
                    hasNext: skip + limitNum < total,
                    hasPrev: pageNum > 1
                },
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            };
            res.json(response);
            logger_1.logger.info('Filters listed successfully', {
                count: paginatedFilters.length,
                total,
                userId
            });
        }
        catch (error) {
            logger_1.logger.error('Error listing filters:', error);
            res.status(500).json({
                success: false,
                error: api_types_1.API_ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to fetch filters',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        }
    }
    // GET /api/v1/filters/:id - Get specific filter
    async getFilter(req, res) {
        try {
            const { id } = req.params;
            const filter = this.filterStorage.getFilter(id);
            if (!filter) {
                res.status(404).json({
                    success: false,
                    error: api_types_1.API_ERROR_CODES.FILTER_NOT_FOUND,
                    message: 'Filter not found',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                });
                return;
            }
            const response = {
                success: true,
                data: filter,
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            };
            res.json(response);
            logger_1.logger.info('Filter retrieved successfully', {
                filterId: id,
                name: filter.name
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching filter:', error);
            res.status(500).json({
                success: false,
                error: api_types_1.API_ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to fetch filter',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        }
    }
    // POST /api/v1/filters - Create custom filter
    async createFilter(req, res) {
        try {
            const filterData = api_types_1.createFilterSchema.parse(req.body);
            const filter = {
                id: this.generateId(),
                name: filterData.name,
                description: filterData.description,
                criteria: filterData.criteria,
                userId: req.headers['x-user-id'], // From auth middleware
                isPublic: filterData.isPublic || false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                useCount: 0
            };
            this.filterStorage.createFilter(filter);
            const response = {
                success: true,
                data: filter,
                message: 'Filter created successfully',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            };
            res.status(201).json(response);
            logger_1.logger.info('Filter created successfully', {
                filterId: filter.id,
                name: filter.name,
                userId: filter.userId
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                res.status(400).json({
                    success: false,
                    error: api_types_1.API_ERROR_CODES.VALIDATION_ERROR,
                    message: 'Invalid filter data',
                    details: error.errors,
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                });
                return;
            }
            logger_1.logger.error('Error creating filter:', error);
            res.status(500).json({
                success: false,
                error: api_types_1.API_ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to create filter',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        }
    }
    // PUT /api/v1/filters/:id - Update filter
    async updateFilter(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;
            const userId = req.headers['x-user-id'];
            const existingFilter = this.filterStorage.getFilter(id);
            if (!existingFilter) {
                res.status(404).json({
                    success: false,
                    error: api_types_1.API_ERROR_CODES.FILTER_NOT_FOUND,
                    message: 'Filter not found',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                });
                return;
            }
            // Check ownership
            if (existingFilter.userId !== userId) {
                res.status(403).json({
                    success: false,
                    error: api_types_1.API_ERROR_CODES.FORBIDDEN,
                    message: 'Not authorized to update this filter',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                });
                return;
            }
            const updatedFilter = this.filterStorage.updateFilter(id, updates);
            const response = {
                success: true,
                data: updatedFilter,
                message: 'Filter updated successfully',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            };
            res.json(response);
            logger_1.logger.info('Filter updated successfully', {
                filterId: id,
                name: updatedFilter.name
            });
        }
        catch (error) {
            logger_1.logger.error('Error updating filter:', error);
            res.status(500).json({
                success: false,
                error: api_types_1.API_ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to update filter',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        }
    }
    // DELETE /api/v1/filters/:id - Delete filter
    async deleteFilter(req, res) {
        try {
            const { id } = req.params;
            const userId = req.headers['x-user-id'];
            const existingFilter = this.filterStorage.getFilter(id);
            if (!existingFilter) {
                res.status(404).json({
                    success: false,
                    error: api_types_1.API_ERROR_CODES.FILTER_NOT_FOUND,
                    message: 'Filter not found',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                });
                return;
            }
            // Check ownership
            if (existingFilter.userId !== userId) {
                res.status(403).json({
                    success: false,
                    error: api_types_1.API_ERROR_CODES.FORBIDDEN,
                    message: 'Not authorized to delete this filter',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                });
                return;
            }
            const deleted = this.filterStorage.deleteFilter(id);
            if (!deleted) {
                res.status(404).json({
                    success: false,
                    error: api_types_1.API_ERROR_CODES.FILTER_NOT_FOUND,
                    message: 'Filter not found',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                });
                return;
            }
            const response = {
                success: true,
                message: 'Filter deleted successfully',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            };
            res.json(response);
            logger_1.logger.info('Filter deleted successfully', {
                filterId: id
            });
        }
        catch (error) {
            logger_1.logger.error('Error deleting filter:', error);
            res.status(500).json({
                success: false,
                error: api_types_1.API_ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to delete filter',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        }
    }
    // POST /api/v1/filters/:id/execute - Execute filter and get results
    async executeFilter(req, res) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 20, useCache = true } = req.query;
            const filter = this.filterStorage.getFilter(id);
            if (!filter) {
                res.status(404).json({
                    success: false,
                    error: api_types_1.API_ERROR_CODES.FILTER_NOT_FOUND,
                    message: 'Filter not found',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                });
                return;
            }
            // Check for cached results
            if (useCache === 'true') {
                const cachedResults = this.filterStorage.getCachedResults(id);
                if (cachedResults) {
                    const pageNum = parseInt(page);
                    const limitNum = Math.min(parseInt(limit), 100);
                    const skip = (pageNum - 1) * limitNum;
                    const paginatedResults = cachedResults.slice(skip, skip + limitNum);
                    const response = {
                        success: true,
                        data: paginatedResults,
                        pagination: {
                            page: pageNum,
                            limit: limitNum,
                            total: cachedResults.length,
                            totalPages: Math.ceil(cachedResults.length / limitNum),
                            hasNext: skip + limitNum < cachedResults.length,
                            hasPrev: pageNum > 1
                        },
                        message: 'Filter results (cached)',
                        timestamp: new Date().toISOString(),
                        version: '1.0.0'
                    };
                    res.json(response);
                    return;
                }
            }
            // Execute filter
            const results = await this.applyFilter(filter.criteria);
            // Cache results
            this.filterStorage.cacheFilterResults(id, results);
            // Update use count
            this.filterStorage.updateFilter(id, { useCount: filter.useCount + 1 });
            // Apply pagination
            const pageNum = parseInt(page);
            const limitNum = Math.min(parseInt(limit), 100);
            const skip = (pageNum - 1) * limitNum;
            const paginatedResults = results.slice(skip, skip + limitNum);
            const response = {
                success: true,
                data: paginatedResults,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: results.length,
                    totalPages: Math.ceil(results.length / limitNum),
                    hasNext: skip + limitNum < results.length,
                    hasPrev: pageNum > 1
                },
                message: 'Filter executed successfully',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            };
            res.json(response);
            // Broadcast filter results via WebSocket
            this.wsManager.broadcastFilterResults(id, {
                type: 'FILTER_RESULT',
                payload: {
                    filterId: id,
                    results: paginatedResults,
                    count: results.length
                },
                timestamp: new Date().toISOString()
            });
            logger_1.logger.info('Filter executed successfully', {
                filterId: id,
                resultCount: results.length,
                name: filter.name
            });
        }
        catch (error) {
            logger_1.logger.error('Error executing filter:', error);
            res.status(500).json({
                success: false,
                error: api_types_1.API_ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to execute filter',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        }
    }
    async applyFilter(criteria) {
        // Build where clause from filter criteria
        const whereClause = {};
        if (criteria.marketCap) {
            whereClause.marketCap = {};
            if (criteria.marketCap.min !== undefined)
                whereClause.marketCap.gte = criteria.marketCap.min;
            if (criteria.marketCap.max !== undefined)
                whereClause.marketCap.lte = criteria.marketCap.max;
        }
        if (criteria.chain && criteria.chain.length > 0) {
            whereClause.chain = { in: criteria.chain };
        }
        if (criteria.contractAge) {
            const minDate = new Date();
            minDate.setDate(minDate.getDate() - (criteria.contractAge.minDays || 0));
            whereClause.createdAt = { lte: minDate };
        }
        // Safety score filters
        if (criteria.safetyScore || criteria.riskLevel || criteria.liquidity?.required) {
            whereClause.safetyScores = { some: {} };
            if (criteria.safetyScore) {
                if (criteria.safetyScore.min !== undefined) {
                    whereClause.safetyScores.some.overallScore = { gte: criteria.safetyScore.min };
                }
                if (criteria.safetyScore.max !== undefined) {
                    if (!whereClause.safetyScores.some.overallScore) {
                        whereClause.safetyScores.some.overallScore = {};
                    }
                    whereClause.safetyScores.some.overallScore.lte = criteria.safetyScore.max;
                }
            }
            if (criteria.riskLevel && criteria.riskLevel.length > 0) {
                whereClause.safetyScores.some.riskLevel = { in: criteria.riskLevel };
            }
            if (criteria.liquidity?.required) {
                whereClause.safetyScores.some.hasLiquidity = true;
            }
            if (criteria.holderCount) {
                if (criteria.holderCount.min !== undefined) {
                    whereClause.safetyScores.some.holderCount = { gte: criteria.holderCount.min };
                }
                if (criteria.holderCount.max !== undefined) {
                    if (!whereClause.safetyScores.some.holderCount) {
                        whereClause.safetyScores.some.holderCount = {};
                    }
                    whereClause.safetyScores.some.holderCount.lte = criteria.holderCount.max;
                }
            }
        }
        // Fetch tokens with filter criteria
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
            take: 1000 // Limit to prevent performance issues
        });
        // Apply additional filters that require post-processing
        let filteredTokens = tokens;
        if (criteria.volume24h || criteria.priceChange || criteria.liquidity?.min) {
            filteredTokens = tokens.filter(token => {
                const latestPrice = token.priceData[0];
                if (!latestPrice)
                    return false;
                // Volume filter
                if (criteria.volume24h) {
                    const volume = latestPrice.volume24h || 0;
                    if (criteria.volume24h.min !== undefined && volume < criteria.volume24h.min)
                        return false;
                    if (criteria.volume24h.max !== undefined && volume > criteria.volume24h.max)
                        return false;
                }
                // Price change filter
                if (criteria.priceChange) {
                    let priceChange = 0;
                    switch (criteria.priceChange.period) {
                        case '1h':
                            priceChange = latestPrice.priceChange1h || 0;
                            break;
                        case '24h':
                            priceChange = latestPrice.priceChange24h || 0;
                            break;
                        case '7d':
                            priceChange = latestPrice.priceChange7d || 0;
                            break;
                    }
                    if (criteria.priceChange.min !== undefined && priceChange < criteria.priceChange.min)
                        return false;
                    if (criteria.priceChange.max !== undefined && priceChange > criteria.priceChange.max)
                        return false;
                }
                // Liquidity filter
                if (criteria.liquidity?.min !== undefined) {
                    const liquidity = latestPrice.liquidity || 0;
                    if (liquidity < criteria.liquidity.min)
                        return false;
                }
                return true;
            });
        }
        // Apply signal filters
        if (criteria.signals) {
            filteredTokens = filteredTokens.filter(token => {
                if (criteria.signals.types && criteria.signals.types.length > 0) {
                    const hasMatchingSignal = token.tradingSignals.some(signal => criteria.signals.types.includes(signal.signalType));
                    if (!hasMatchingSignal)
                        return false;
                }
                if (criteria.signals.minStrength !== undefined) {
                    const hasStrongSignal = token.tradingSignals.some(signal => signal.strength >= criteria.signals.minStrength);
                    if (!hasStrongSignal)
                        return false;
                }
                if (criteria.signals.minConfidence !== undefined) {
                    const hasConfidentSignal = token.tradingSignals.some(signal => signal.confidence >= criteria.signals.minConfidence);
                    if (!hasConfidentSignal)
                        return false;
                }
                return true;
            });
        }
        // Convert to TokenResponse format
        return filteredTokens.map(token => ({
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
    }
    generateId() {
        return `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.FiltersController = FiltersController;
//# sourceMappingURL=filters.controller.js.map