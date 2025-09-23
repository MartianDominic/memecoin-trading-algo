// Filter Routes - REST endpoints for custom filter management
import { Router } from 'express';
import { FiltersController } from '../controllers/filters.controller';
import { validate, validatePagination } from '../middleware/validation.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { createFilterSchema } from '../types/api.types';
import { z } from 'zod';

// Validation schemas for filter routes
const filterIdSchema = z.object({
  id: z.string().min(1, 'Filter ID is required')
});

const filterListQuerySchema = z.object({
  page: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1)).optional().default(1),
  limit: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1).max(100)).optional().default(20),
  userId: z.string().optional(),
  isPublic: z.string().transform(val => val === 'true').pipe(z.boolean()).optional()
});

const executeFilterQuerySchema = z.object({
  page: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1)).optional().default(1),
  limit: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1).max(100)).optional().default(20),
  useCache: z.string().transform(val => val === 'true').pipe(z.boolean()).optional().default(true)
});

export function createFilterRoutes(filtersController: FiltersController): Router {
  const router = Router();

  // GET /api/v1/filters - List user filters
  router.get(
    '/',
    validate(filterListQuerySchema, 'query'),
    asyncHandler(filtersController.listFilters.bind(filtersController))
  );

  // GET /api/v1/filters/:id - Get specific filter
  router.get(
    '/:id',
    validate(filterIdSchema, 'params'),
    asyncHandler(filtersController.getFilter.bind(filtersController))
  );

  // POST /api/v1/filters - Create custom filter (requires auth)
  router.post(
    '/',
    requireAuth,
    validate(createFilterSchema, 'body'),
    asyncHandler(filtersController.createFilter.bind(filtersController))
  );

  // PUT /api/v1/filters/:id - Update filter (requires auth)
  router.put(
    '/:id',
    requireAuth,
    validate(filterIdSchema, 'params'),
    validate(createFilterSchema.partial(), 'body'), // Allow partial updates
    asyncHandler(filtersController.updateFilter.bind(filtersController))
  );

  // DELETE /api/v1/filters/:id - Delete filter (requires auth)
  router.delete(
    '/:id',
    requireAuth,
    validate(filterIdSchema, 'params'),
    asyncHandler(filtersController.deleteFilter.bind(filtersController))
  );

  // POST /api/v1/filters/:id/execute - Execute filter and get results
  router.post(
    '/:id/execute',
    validate(filterIdSchema, 'params'),
    validate(executeFilterQuerySchema, 'query'),
    asyncHandler(filtersController.executeFilter.bind(filtersController))
  );

  // GET /api/v1/filters/public/popular - Get popular public filters
  router.get(
    '/public/popular',
    validatePagination,
    asyncHandler(async (req, res) => {
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
    })
  );

  // GET /api/v1/filters/templates - Get filter templates
  router.get(
    '/templates',
    validatePagination,
    asyncHandler(async (req, res) => {
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
    })
  );

  // POST /api/v1/filters/templates/:templateId/create - Create filter from template
  router.post(
    '/templates/:templateId/create',
    requireAuth,
    validate(z.object({ templateId: z.string() }), 'params'),
    validate(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      customizations: z.object({}).optional()
    }), 'body'),
    asyncHandler(async (req, res) => {
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
    })
  );

  // GET /api/v1/filters/:id/performance - Get filter performance metrics
  router.get(
    '/:id/performance',
    validate(filterIdSchema, 'params'),
    asyncHandler(async (req, res) => {
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
    })
  );

  return router;
}