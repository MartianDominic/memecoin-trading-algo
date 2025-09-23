import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { createApiError } from '../middleware/error-handler';
import { logger } from '../config/logger';

export const filtersRouter = Router();

// Validation schemas
const createFilterSchema = z.object({
  name: z.string().min(1, 'Filter name is required').max(100),
  description: z.string().optional(),
  criteria: z.object({
    minLiquidity: z.number().min(0).optional(),
    maxAge: z.number().min(0).optional(),
    minSafetyScore: z.number().min(0).max(10).optional(),
    maxSlippage: z.number().min(0).max(100).optional(),
    requiredFilters: z.array(z.enum(['dexscreener', 'rugcheck', 'jupiter', 'solscan'])).optional(),
    customConditions: z.array(z.object({
      field: z.string(),
      operator: z.enum(['>', '<', '>=', '<=', '=', '!=', 'contains', 'not_contains']),
      value: z.union([z.string(), z.number(), z.boolean()]),
    })).optional(),
  }),
});

const updateFilterSchema = createFilterSchema.partial().omit({ name: true }).extend({
  name: z.string().min(1).max(100).optional(),
});

const getFiltersQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(50)).default('20'),
});

// GET /api/v1/filters - List all user filters
filtersRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = getFiltersQuerySchema.parse(req.query);
    const { page, limit } = query;
    const offset = (page - 1) * limit;

    const [filters, totalCount] = await Promise.all([
      prisma.userFilter.findMany({
        orderBy: [
          { useCount: 'desc' },
          { updatedAt: 'desc' },
        ],
        skip: offset,
        take: limit,
      }),
      prisma.userFilter.count(),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    logger.info('User filters retrieved', {
      count: filters.length,
      totalCount,
      page,
    });

    res.json({
      data: filters,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/filters - Create new user filter
filtersRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filterData = createFilterSchema.parse(req.body);

    // Check if filter name already exists
    const existingFilter = await prisma.userFilter.findFirst({
      where: { name: filterData.name },
    });

    if (existingFilter) {
      throw createApiError('Filter with this name already exists', 400, 'FILTER_NAME_EXISTS');
    }

    const filter = await prisma.userFilter.create({
      data: filterData,
    });

    logger.info('User filter created', {
      filterId: filter.id,
      name: filter.name,
    });

    res.status(201).json({
      data: filter,
      message: 'Filter created successfully',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/filters/:id - Get specific filter
filtersRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const filter = await prisma.userFilter.findUnique({
      where: { id },
    });

    if (!filter) {
      throw createApiError('Filter not found', 404, 'FILTER_NOT_FOUND');
    }

    logger.info('User filter retrieved', { filterId: filter.id });

    res.json({
      data: filter,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/filters/:id - Update filter
filtersRouter.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updateData = updateFilterSchema.parse(req.body);

    // Check if filter exists
    const existingFilter = await prisma.userFilter.findUnique({
      where: { id },
    });

    if (!existingFilter) {
      throw createApiError('Filter not found', 404, 'FILTER_NOT_FOUND');
    }

    // Check name uniqueness if name is being updated
    if (updateData.name && updateData.name !== existingFilter.name) {
      const nameExists = await prisma.userFilter.findFirst({
        where: {
          name: updateData.name,
          id: { not: id },
        },
      });

      if (nameExists) {
        throw createApiError('Filter with this name already exists', 400, 'FILTER_NAME_EXISTS');
      }
    }

    const updatedFilter = await prisma.userFilter.update({
      where: { id },
      data: updateData,
    });

    logger.info('User filter updated', {
      filterId: updatedFilter.id,
      name: updatedFilter.name,
    });

    res.json({
      data: updatedFilter,
      message: 'Filter updated successfully',
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/filters/:id - Delete filter
filtersRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const filter = await prisma.userFilter.findUnique({
      where: { id },
    });

    if (!filter) {
      throw createApiError('Filter not found', 404, 'FILTER_NOT_FOUND');
    }

    await prisma.userFilter.delete({
      where: { id },
    });

    logger.info('User filter deleted', {
      filterId: id,
      name: filter.name,
    });

    res.json({
      message: 'Filter deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/filters/:id/use - Mark filter as used (increment use count)
filtersRouter.post('/:id/use', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const filter = await prisma.userFilter.update({
      where: { id },
      data: {
        useCount: { increment: 1 },
        lastUsed: new Date(),
      },
    });

    logger.info('Filter used', {
      filterId: filter.id,
      useCount: filter.useCount,
    });

    res.json({
      data: filter,
      message: 'Filter usage recorded',
    });
  } catch (error) {
    if ((error as any).code === 'P2025') {
      next(createApiError('Filter not found', 404, 'FILTER_NOT_FOUND'));
    } else {
      next(error);
    }
  }
});

// POST /api/v1/filters/:id/test - Test filter against current tokens
filtersRouter.post('/:id/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const filter = await prisma.userFilter.findUnique({
      where: { id },
    });

    if (!filter) {
      throw createApiError('Filter not found', 404, 'FILTER_NOT_FOUND');
    }

    // Apply filter criteria to tokens
    const criteria = filter.criteria as any;
    const where: any = {};

    if (criteria.minLiquidity) {
      where.liquidityUsd = { gte: criteria.minLiquidity };
    }

    if (criteria.maxAge) {
      where.ageHours = { lte: criteria.maxAge };
    }

    if (criteria.minSafetyScore) {
      where.safetyScores = {
        some: {
          safetyScore: { gte: criteria.minSafetyScore },
        },
      };
    }

    const matchingTokens = await prisma.token.findMany({
      where,
      include: {
        safetyScores: {
          orderBy: { analyzedAt: 'desc' },
          take: 1,
        },
        tradingData: {
          orderBy: { analyzedAt: 'desc' },
          take: 1,
        },
      },
      take: 50, // Limit for testing
    });

    logger.info('Filter tested', {
      filterId: filter.id,
      matchingTokens: matchingTokens.length,
    });

    res.json({
      data: {
        filter,
        matchingTokens: matchingTokens.length,
        sampleTokens: matchingTokens.slice(0, 10), // Return first 10 as sample
        criteria: criteria,
      },
      message: 'Filter test completed',
    });
  } catch (error) {
    next(error);
  }
});

export default filtersRouter;