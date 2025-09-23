"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTokenRoutes = createTokenRoutes;
// Token Routes - REST endpoints for token operations
const express_1 = require("express");
const validation_middleware_1 = require("../middleware/validation.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
const api_types_1 = require("../types/api.types");
function createTokenRoutes(tokensController) {
    const router = (0, express_1.Router)();
    // GET /api/v1/tokens - List tokens with pagination and filters
    router.get('/', validation_middleware_1.validatePagination, (0, validation_middleware_1.validate)(api_types_1.tokenListQuerySchema, 'query'), (0, error_middleware_1.asyncHandler)(tokensController.listTokens.bind(tokensController)));
    // GET /api/v1/tokens/search - Search tokens by symbol/name
    router.get('/search', (0, validation_middleware_1.validate)(api_types_1.tokenListQuerySchema, 'query'), (0, error_middleware_1.asyncHandler)(tokensController.listTokens.bind(tokensController)) // Reuse list with search
    );
    // GET /api/v1/tokens/:address - Get specific token details
    router.get('/:address', validation_middleware_1.validateTokenAddress, (0, error_middleware_1.asyncHandler)(tokensController.getToken.bind(tokensController)));
    // POST /api/v1/tokens - Create/update token (for data pipeline, requires premium)
    router.post('/', (0, auth_middleware_1.requireTier)('premium'), (0, error_middleware_1.asyncHandler)(tokensController.createOrUpdateToken.bind(tokensController)));
    // POST /api/v1/tokens/analyze - Manual token analysis (requires premium)
    router.post('/analyze', (0, auth_middleware_1.requireTier)('premium'), (0, validation_middleware_1.validate)(api_types_1.tokenListQuerySchema.pick({ search: true }), 'body'), (0, error_middleware_1.asyncHandler)(async (req, res) => {
        // This would trigger manual analysis of a token
        res.json({
            success: true,
            message: 'Token analysis started',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    }));
    // GET /api/v1/tokens/:address/price-history - Get price history
    router.get('/:address/price-history', validation_middleware_1.validateTokenAddress, (0, validation_middleware_1.validate)(api_types_1.tokenListQuerySchema.pick({ page: true, limit: true }), 'query'), (0, error_middleware_1.asyncHandler)(async (req, res) => {
        // Mock price history endpoint
        res.json({
            success: true,
            data: [],
            message: 'Price history endpoint - implementation pending',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    }));
    // GET /api/v1/tokens/:address/safety-score - Get safety analysis
    router.get('/:address/safety-score', validation_middleware_1.validateTokenAddress, (0, error_middleware_1.asyncHandler)(async (req, res) => {
        // Mock safety score endpoint
        res.json({
            success: true,
            data: null,
            message: 'Safety score endpoint - implementation pending',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    }));
    // GET /api/v1/tokens/:address/signals - Get trading signals
    router.get('/:address/signals', validation_middleware_1.validateTokenAddress, (0, error_middleware_1.asyncHandler)(async (req, res) => {
        // Mock trading signals endpoint
        res.json({
            success: true,
            data: [],
            message: 'Trading signals endpoint - implementation pending',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    }));
    return router;
}
//# sourceMappingURL=tokens.routes.js.map