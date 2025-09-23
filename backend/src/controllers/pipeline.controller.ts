import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { createApiError } from '../middleware/error-handler';
import { logger } from '../config/logger';

export const pipelineRouter = Router();

// Validation schemas
const getPipelineRunsQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(50)).default('20'),
  status: z.enum(['running', 'completed', 'failed']).optional(),
});

// GET /api/v1/pipeline/runs - List pipeline runs
pipelineRouter.get('/runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = getPipelineRunsQuerySchema.parse(req.query);
    const { page, limit, status } = query;
    const offset = (page - 1) * limit;

    const where = status ? { status } : {};

    const [runs, totalCount] = await Promise.all([
      prisma.pipelineRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.pipelineRun.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    logger.info('Pipeline runs retrieved', {
      count: runs.length,
      totalCount,
      page,
      status,
    });

    res.json({
      data: runs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      filters: { status },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/pipeline/runs/:id - Get specific pipeline run
pipelineRouter.get('/runs/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const run = await prisma.pipelineRun.findUnique({
      where: { id },
    });

    if (!run) {
      throw createApiError('Pipeline run not found', 404, 'PIPELINE_RUN_NOT_FOUND');
    }

    logger.info('Pipeline run retrieved', { runId: run.id });

    res.json({
      data: run,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/pipeline/stats - Get pipeline statistics
pipelineRouter.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get runs in different time periods
    const [
      totalRuns,
      runsLast24h,
      runsLastWeek,
      successfulRuns24h,
      failedRuns24h,
      avgDuration24h,
      currentStatus
    ] = await Promise.all([
      prisma.pipelineRun.count(),
      prisma.pipelineRun.count({
        where: {
          startedAt: { gte: oneDayAgo },
        },
      }),
      prisma.pipelineRun.count({
        where: {
          startedAt: { gte: oneWeekAgo },
        },
      }),
      prisma.pipelineRun.count({
        where: {
          startedAt: { gte: oneDayAgo },
          status: 'completed',
        },
      }),
      prisma.pipelineRun.count({
        where: {
          startedAt: { gte: oneDayAgo },
          status: 'failed',
        },
      }),
      prisma.pipelineRun.aggregate({
        where: {
          startedAt: { gte: oneDayAgo },
          status: 'completed',
        },
        _avg: {
          duration: true,
        },
      }),
      prisma.pipelineRun.findFirst({
        where: {
          status: 'running',
        },
        orderBy: {
          startedAt: 'desc',
        },
      }),
    ]);

    // Calculate success rate
    const successRate24h = runsLast24h > 0
      ? ((successfulRuns24h / runsLast24h) * 100).toFixed(2)
      : '0.00';

    // Get token processing stats
    const tokenStats = await prisma.pipelineRun.aggregate({
      where: {
        startedAt: { gte: oneDayAgo },
        status: 'completed',
      },
      _sum: {
        tokensProcessed: true,
        tokensPassed: true,
        stage1Passed: true,
        stage2Passed: true,
        stage3Passed: true,
        stage4Passed: true,
      },
    });

    const stats = {
      overview: {
        totalRuns,
        runsLast24h,
        runsLastWeek,
        successRate24h: `${successRate24h}%`,
        avgDuration24h: avgDuration24h._avg.duration ? `${avgDuration24h._avg.duration.toFixed(2)}s` : 'N/A',
        currentlyRunning: currentStatus ? true : false,
        lastRunStarted: currentStatus?.startedAt || null,
      },
      performance: {
        successful24h: successfulRuns24h,
        failed24h: failedRuns24h,
        tokensProcessed24h: tokenStats._sum.tokensProcessed || 0,
        tokensPassed24h: tokenStats._sum.tokensPassed || 0,
      },
      stageStats: {
        stage1Passed: tokenStats._sum.stage1Passed || 0,
        stage2Passed: tokenStats._sum.stage2Passed || 0,
        stage3Passed: tokenStats._sum.stage3Passed || 0,
        stage4Passed: tokenStats._sum.stage4Passed || 0,
      },
    };

    logger.info('Pipeline statistics retrieved');

    res.json({
      data: stats,
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/pipeline/health - Get pipeline health status
pipelineRouter.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Check if pipeline has run recently
    const recentRuns = await prisma.pipelineRun.findMany({
      where: {
        startedAt: { gte: fiveMinutesAgo },
      },
      orderBy: { startedAt: 'desc' },
      take: 1,
    });

    const isRunning = await prisma.pipelineRun.findFirst({
      where: { status: 'running' },
    });

    // Get recent error rate
    const recentFailures = await prisma.pipelineRun.count({
      where: {
        startedAt: { gte: new Date(now.getTime() - 30 * 60 * 1000) }, // Last 30 minutes
        status: 'failed',
      },
    });

    const recentTotal = await prisma.pipelineRun.count({
      where: {
        startedAt: { gte: new Date(now.getTime() - 30 * 60 * 1000) },
      },
    });

    const errorRate = recentTotal > 0 ? (recentFailures / recentTotal) * 100 : 0;

    const health = {
      status: errorRate > 50 ? 'unhealthy' : errorRate > 20 ? 'degraded' : 'healthy',
      isRunning: !!isRunning,
      lastRun: recentRuns[0]?.startedAt || null,
      errorRate: `${errorRate.toFixed(2)}%`,
      recentFailures,
      recentTotal,
      uptime: process.uptime(),
    };

    const statusCode = health.status === 'healthy' ? 200 : 503;

    logger.info('Pipeline health checked', { health });

    res.status(statusCode).json({
      data: health,
      checkedAt: now.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/pipeline/trigger - Manually trigger pipeline run (development only)
pipelineRouter.post('/trigger', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Only allow in development mode
    if (process.env.NODE_ENV === 'production') {
      throw createApiError('Manual pipeline triggers not allowed in production', 403, 'FORBIDDEN');
    }

    // Check if pipeline is already running
    const runningPipeline = await prisma.pipelineRun.findFirst({
      where: { status: 'running' },
    });

    if (runningPipeline) {
      throw createApiError('Pipeline is already running', 409, 'PIPELINE_ALREADY_RUNNING');
    }

    // Create new pipeline run
    const pipelineRun = await prisma.pipelineRun.create({
      data: {
        status: 'running',
      },
    });

    logger.info('Pipeline manually triggered', { runId: pipelineRun.id });

    // In a real implementation, you would trigger the actual pipeline here
    // For now, we'll just return the created run

    res.status(202).json({
      data: pipelineRun,
      message: 'Pipeline triggered successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default pipelineRouter;