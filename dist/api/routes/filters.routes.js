"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFilterRoutes = createFilterRoutes;
// Filter Routes - REST endpoints for custom filter management
const express_1 = require("express");
const validation_middleware_1 = require("../middleware/validation.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
const api_types_1 = require("../types/api.types");
const zod_1 = require("zod");
// Validation schemas for filter routes
const filterIdSchema = zod_1.z.object({
    id: zod_1.z.string().min(1, 'Filter ID is required')
});
const filterListQuerySchema = zod_1.z.object({
    page: zod_1.z.string().transform(val => parseInt(val, 10)).pipe(zod_1.z.number().min(1)).optional().default(1),
    limit: zod_1.z.string().transform(val => parseInt(val, 10)).pipe(zod_1.z.number().min(1).max(100)).optional().default(20),
    userId: zod_1.z.string().optional(),
    isPublic: zod_1.z.string().transform(val => val === 'true').pipe(zod_1.z.boolean()).optional()
});
const executeFilterQuerySchema = zod_1.z.object({
    page: zod_1.z.string().transform(val => parseInt(val, 10)).pipe(zod_1.z.number().min(1)).optional().default(1),
    limit: zod_1.z.string().transform(val => parseInt(val, 10)).pipe(zod_1.z.number().min(1).max(100)).optional().default(20),
    useCache: zod_1.z.string().transform(val => val === 'true').pipe(zod_1.z.boolean()).optional().default(true)
});
function createFilterRoutes(filtersController) {
    const router = (0, express_1.Router)();
    // GET /api/v1/filters - List user filters
    router.get('/', (0, validation_middleware_1.validate)(filterListQuerySchema, 'query'), (0, error_middleware_1.asyncHandler)(filtersController.listFilters.bind(filtersController)));
    // GET /api/v1/filters/:id - Get specific filter
    router.get('/:id', (0, validation_middleware_1.validate)(filterIdSchema, 'params'), (0, error_middleware_1.asyncHandler)(filtersController.getFilter.bind(filtersController)));
    // POST /api/v1/filters - Create custom filter (requires auth)
    router.post('/', auth_middleware_1.requireAuth, (0, validation_middleware_1.validate)(api_types_1.createFilterSchema, 'body'), (0, error_middleware_1.asyncHandler)(filtersController.createFilter.bind(filtersController)));
    // PUT /api/v1/filters/:id - Update filter (requires auth)
    router.put('/:id', auth_middleware_1.requireAuth, (0, validation_middleware_1.validate)(filterIdSchema, 'params'), (0, validation_middleware_1.validate)(api_types_1.createFilterSchema.partial(), 'body'), // Allow partial updates
    (0, error_middleware_1.asyncHandler)(filtersController.updateFilter.bind(filtersController)));
    // DELETE /api/v1/filters/:id - Delete filter (requires auth)
    router.delete('/:id', auth_middleware_1.requireAuth, (0, validation_middleware_1.validate)(filterIdSchema, 'params'), (0, error_middleware_1.asyncHandler)(filtersController.deleteFilter.bind(filtersController)));
    // POST /api/v1/filters/:id/execute - Execute filter and get results
    router.post('/:id/execute', (0, validation_middleware_1.validate)(filterIdSchema, 'params'), (0, validation_middleware_1.validate)(executeFilterQuerySchema, 'query'), (0, error_middleware_1.asyncHandler)(filtersController.executeFilter.bind(filtersController)));
    // GET /api/v1/filters/public/popular - Get popular public filters
    router.get('/public/popular', validation_middleware_1.validatePagination, (0, error_middleware_1.asyncHandler)(async (req, res) => {
        // Mock popular filters endpoint
        res.json({
            success: true,
            data: [],
            pagination: {
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 0,
                hasNext: false,
                hasPrev: false
            },
            message: 'Popular filters endpoint - implementation pending',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    }));
    // GET /api/v1/filters/templates - Get filter templates
    router.get('/templates', validation_middleware_1.validatePagination, (0, error_middleware_1.asyncHandler)(async (req, res) => {
        // Mock filter templates
        const templates = [
            {
                id: 'template_1',
                name: 'High Volume Memecoins',
                description: 'Tokens with high 24h volume and good liquidity',
                criteria: {
                    volume24h: { min: 100000 },
                    liquidity: { required: true, min: 50000 },
                    safetyScore: { min: 6 }
                },
                category: 'volume',
                isTemplate: true
            },
            {
                id: 'template_2',
                name: 'Safe New Tokens',
                description: 'Recently launched tokens with good safety scores',
                criteria: {
                    contractAge: { minDays: 1 },
                    safetyScore: { min: 7 },
                    riskLevel: ['VERY_LOW', 'LOW'],
                    liquidity: { required: true }
                },
                category: 'safety',
                isTemplate: true
            },
            {
                id: 'template_3',
                name: 'Bullish Signals',
                description: 'Tokens with strong buy signals',
                criteria: {
                    signals: {
                        types: ['BUY', 'STRONG_BUY'],
                        minStrength: 0.7,
                        minConfidence: 0.8
                    },
                    safetyScore: { min: 5 }
                },
                category: 'signals',
                isTemplate: true
            }
        ];
        res.json({
            success: true,
            data: templates,
            pagination: {
                page: 1,
                limit: 20,
                total: templates.length,
                totalPages: 1,
                hasNext: false,
                hasPrev: false
            },
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    }));
    // POST /api/v1/filters/templates/:templateId/create - Create filter from template
    router.post('/templates/:templateId/create', auth_middleware_1.requireAuth, (0, validation_middleware_1.validate)(zod_1.z.object({ templateId: zod_1.z.string() }), 'params'), (0, validation_middleware_1.validate)(zod_1.z.object({
        name: zod_1.z.string().min(1).max(100),
        description: zod_1.z.string().max(500).optional(),
        customizations: zod_1.z.object({}).optional()
    }), 'body'), (0, error_middleware_1.asyncHandler)(async (req, res) => {
        // Mock create from template
        res.json({
            success: true,
            data: {
                id: `filter_${Date.now()}`,
                name: req.body.name,
                description: req.body.description,
                createdAt: new Date().toISOString()
            },
            message: 'Filter created from template',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    }));
    // GET /api/v1/filters/:id/performance - Get filter performance metrics
    router.get('/:id/performance', (0, validation_middleware_1.validate)(filterIdSchema, 'params'), (0, error_middleware_1.asyncHandler)(async (req, res) => {
        // Mock performance metrics
        res.json({
            success: true,
            data: {
                totalExecutions: 0,
                avgExecutionTime: 0,
                avgResultCount: 0,
                popularityScore: 0,
                lastExecuted: null,
                successRate: 100
            },
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    }));
    return router;
}
//# sourceMappingURL=filters.routes.js.map