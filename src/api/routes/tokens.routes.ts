// Token Routes - REST endpoints for token operations
import { Router } from 'express';
import { TokensController } from '../controllers/tokens.controller';
import { validate, validatePagination, validateTokenAddress } from '../middleware/validation.middleware';
import { requireTier } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { tokenListQuerySchema } from '../types/api.types';

export function createTokenRoutes(tokensController: TokensController): Router {
  const router = Router();

  // GET /api/v1/tokens - List tokens with pagination and filters
  router.get(
    '/',
    validatePagination,
    validate(tokenListQuerySchema, 'query'),
    asyncHandler(tokensController.listTokens.bind(tokensController))
  );

  // GET /api/v1/tokens/search - Search tokens by symbol/name
  router.get(
    '/search',
    validate(tokenListQuerySchema, 'query'),
    asyncHandler(tokensController.listTokens.bind(tokensController)) // Reuse list with search
  );

  // GET /api/v1/tokens/:address - Get specific token details
  router.get(
    '/:address',
    validateTokenAddress,
    asyncHandler(tokensController.getToken.bind(tokensController))
  );

  // POST /api/v1/tokens - Create/update token (for data pipeline, requires premium)
  router.post(
    '/',
    requireTier('premium'),
    asyncHandler(tokensController.createOrUpdateToken.bind(tokensController))
  );

  // POST /api/v1/tokens/analyze - Manual token analysis (requires premium)
  router.post(
    '/analyze',
    requireTier('premium'),
    validate(tokenListQuerySchema.pick({ search: true }), 'body'),
    asyncHandler(async (req, res) => {
      // This would trigger manual analysis of a token
      res.json({
        success: true,
        message: 'Token analysis started',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    })
  );

  // GET /api/v1/tokens/:address/price-history - Get price history
  router.get(
    '/:address/price-history',
    validateTokenAddress,
    validate(tokenListQuerySchema.pick({ page: true, limit: true }), 'query'),
    asyncHandler(async (req, res) => {
      // Mock price history endpoint
      res.json({
        success: true,
        data: [],
        message: 'Price history endpoint - implementation pending',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    })
  );

  // GET /api/v1/tokens/:address/safety-score - Get safety analysis
  router.get(
    '/:address/safety-score',
    validateTokenAddress,
    asyncHandler(async (req, res) => {
      // Mock safety score endpoint
      res.json({
        success: true,
        data: null,
        message: 'Safety score endpoint - implementation pending',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    })
  );

  // GET /api/v1/tokens/:address/signals - Get trading signals
  router.get(
    '/:address/signals',
    validateTokenAddress,
    asyncHandler(async (req, res) => {
      // Mock trading signals endpoint
      res.json({
        success: true,
        data: [],
        message: 'Trading signals endpoint - implementation pending',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    })
  );

  return router;
}