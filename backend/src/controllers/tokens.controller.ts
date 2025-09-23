import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { createApiError } from '../middleware/error-handler';
import { logger } from '../config/logger';

export const tokensRouter = Router();

// Validation schemas
const getTokensQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('20'),
  sort: z.enum(['createdAt', 'currentPrice', 'marketCap', 'volume24h', 'safetyScore']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  passed: z.string().transform(val => val === 'true').optional(),
  minSafetyScore: z.string().transform(Number).pipe(z.number().min(0).max(10)).optional(),
  minLiquidity: z.string().transform(Number).pipe(z.number().min(0)).optional(),
  maxAge: z.string().transform(Number).pipe(z.number().min(0)).optional(),
});

const getTokenParamsSchema = z.object({
  address: z.string().min(1, 'Token address is required'),
});

// GET /api/v1/tokens - List tokens with filtering and pagination
tokensRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = getTokensQuerySchema.parse(req.query);
    const { page, limit, sort, order, passed, minSafetyScore, minLiquidity, maxAge } = query;

    // Build where clause
    const where: any = {};

    if (passed !== undefined) {
      where.passedFilters = passed;
    }

    if (minLiquidity !== undefined) {
      where.liquidityUsd = { gte: minLiquidity };
    }

    if (maxAge !== undefined) {
      where.ageHours = { lte: maxAge };
    }

    // Handle safety score filtering (join with SafetyScore table)
    let include: any = {
      safetyScores: {
        orderBy: { analyzedAt: 'desc' },
        take: 1,
      },
      tradingData: {
        orderBy: { analyzedAt: 'desc' },
        take: 1,
      },
      creatorAnalysis: {
        orderBy: { analyzedAt: 'desc' },
        take: 1,
      },
    };

    if (minSafetyScore !== undefined) {
      where.safetyScores = {
        some: {
          safetyScore: { gte: minSafetyScore },
        },
      };
    }

    // Calculate offset
    const offset = (page - 1) * limit;

    // Execute query with pagination
    const [tokens, totalCount] = await Promise.all([
      prisma.token.findMany({
        where,
        include,
        orderBy: { [sort]: order },
        skip: offset,
        take: limit,
      }),
      prisma.token.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    logger.info('Tokens retrieved', {
      count: tokens.length,
      totalCount,
      page,
      totalPages,
      filters: { passed, minSafetyScore, minLiquidity, maxAge },
    });

    res.json({
      data: tokens,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
      filters: {
        sort,
        order,
        passed,
        minSafetyScore,
        minLiquidity,
        maxAge,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/tokens/:address - Get specific token details
tokensRouter.get('/:address', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = getTokenParamsSchema.parse(req.params);

    const token = await prisma.token.findUnique({
      where: { address },
      include: {
        safetyScores: {
          orderBy: { analyzedAt: 'desc' },
        },
        tradingData: {
          orderBy: { analyzedAt: 'desc' },
        },
        creatorAnalysis: {
          orderBy: { analyzedAt: 'desc' },
        },
      },
    });

    if (!token) {
      throw createApiError('Token not found', 404, 'TOKEN_NOT_FOUND');
    }

    logger.info('Token details retrieved', { address, tokenId: token.id });

    res.json({
      data: token,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/tokens/:address/analysis - Get detailed analysis for a token
tokensRouter.get('/:address/analysis', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = getTokenParamsSchema.parse(req.params);

    const token = await prisma.token.findUnique({
      where: { address },
      include: {
        safetyScores: {
          orderBy: { analyzedAt: 'desc' },
          take: 5, // Last 5 safety analyses
        },
        tradingData: {
          orderBy: { analyzedAt: 'desc' },
          take: 5, // Last 5 trading analyses
        },
        creatorAnalysis: {
          orderBy: { analyzedAt: 'desc' },
          take: 1, // Latest creator analysis
        },
      },
    });

    if (!token) {
      throw createApiError('Token not found', 404, 'TOKEN_NOT_FOUND');
    }

    // Calculate analysis summary
    const latestSafety = token.safetyScores[0];
    const latestTrading = token.tradingData[0];
    const latestCreator = token.creatorAnalysis[0];

    const analysisSummary = {
      overallScore: latestSafety?.safetyScore || 0,
      riskLevel: latestSafety?.riskLevel || 'unknown',
      tradingViable: latestTrading?.routingAvailable || false,
      creatorTrusted: latestCreator ? latestCreator.creatorRugCount === 0 : false,
      passedAllFilters: token.passedFilters,
      filterStage: token.filterStage,
    };

    logger.info('Token analysis retrieved', { address, tokenId: token.id });

    res.json({
      data: {
        token,
        analysis: analysisSummary,
        history: {
          safetyTrend: token.safetyScores.map(s => ({
            score: s.safetyScore,
            analyzedAt: s.analyzedAt,
          })),
          tradingHistory: token.tradingData.map(t => ({
            slippage500: t.slippage500,
            analyzedAt: t.analyzedAt,
          })),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default tokensRouter;