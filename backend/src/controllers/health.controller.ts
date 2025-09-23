import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

export const healthRouter = Router();

// GET /api/v1/health - Basic health check
healthRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbStatus = await checkDatabaseHealth();
    const apiStatus = await checkApiServicesHealth();

    const overallStatus = dbStatus.healthy && apiStatus.allHealthy ? 'healthy' : 'degraded';

    res.status(overallStatus === 'healthy' ? 200 : 503).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: dbStatus,
        apiServices: apiStatus,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/health/detailed - Detailed health check
healthRouter.get('/detailed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [dbStatus, apiStatus, systemMetrics] = await Promise.all([
      checkDatabaseHealth(),
      checkApiServicesHealth(),
      getSystemMetrics(),
    ]);

    const overallStatus = dbStatus.healthy && apiStatus.allHealthy ? 'healthy' : 'degraded';

    res.status(overallStatus === 'healthy' ? 200 : 503).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: dbStatus,
        apiServices: apiStatus,
        system: systemMetrics,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Helper functions
async function checkDatabaseHealth() {
  try {
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - startTime;

    // Get recent pipeline runs
    const recentRuns = await prisma.pipelineRun.count({
      where: {
        startedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    return {
      healthy: true,
      responseTime,
      recentPipelineRuns: recentRuns,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkApiServicesHealth() {
  try {
    // Get recent API health records
    const healthRecords = await prisma.apiHealth.findMany({
      where: {
        checkedAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
        },
      },
      orderBy: {
        checkedAt: 'desc',
      },
    });

    // Group by service
    const serviceHealth: Record<string, any> = {};
    const services = ['dexscreener', 'rugcheck', 'jupiter', 'solscan'];

    for (const service of services) {
      const serviceRecords = healthRecords.filter(h => h.serviceName === service);
      const latestRecord = serviceRecords[0];

      serviceHealth[service] = {
        status: latestRecord?.status || 'unknown',
        responseTime: latestRecord?.responseTime || null,
        errorRate: latestRecord?.errorRate || null,
        lastChecked: latestRecord?.checkedAt || null,
        rateLimitHit: latestRecord?.rateLimitHit || false,
      };
    }

    const allHealthy = Object.values(serviceHealth).every(
      (service: any) => service.status === 'healthy'
    );

    return {
      allHealthy,
      services: serviceHealth,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('API services health check failed:', error);
    return {
      allHealthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString(),
    };
  }
}

async function getSystemMetrics() {
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();

  return {
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`,
    },
    uptime: `${Math.round(uptime)} seconds`,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
  };
}

export default healthRouter;