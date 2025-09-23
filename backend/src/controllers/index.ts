import { Express } from 'express';
import { tokensRouter } from './tokens.controller';
import { filtersRouter } from './filters.controller';
import { healthRouter } from './health.controller';
import { pipelineRouter } from './pipeline.controller';

export const setupRoutes = (app: Express): void => {
  // API version prefix
  const API_PREFIX = '/api/v1';

  // Route setup
  app.use(`${API_PREFIX}/tokens`, tokensRouter);
  app.use(`${API_PREFIX}/filters`, filtersRouter);
  app.use(`${API_PREFIX}/health`, healthRouter);
  app.use(`${API_PREFIX}/pipeline`, pipelineRouter);

  // Root API endpoint
  app.get(API_PREFIX, (req, res) => {
    res.json({
      message: 'Memecoin Trading API v1',
      version: '1.0.0',
      endpoints: {
        tokens: `${API_PREFIX}/tokens`,
        filters: `${API_PREFIX}/filters`,
        health: `${API_PREFIX}/health`,
        pipeline: `${API_PREFIX}/pipeline`,
      },
      documentation: 'https://github.com/your-repo/memecoin-trading-algo',
    });
  });
};