import { Request, Response, NextFunction } from 'express';
import { apiLogger } from '../config/logger';

interface LoggedRequest extends Request {
  startTime?: number;
}

export const requestLogger = (req: LoggedRequest, res: Response, next: NextFunction) => {
  req.startTime = Date.now();

  // Log request
  apiLogger.info('Request started', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
  });

  // Override response end to log completion
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = req.startTime ? Date.now() - req.startTime : 0;

    apiLogger.info('Request completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });

    return originalEnd.apply(this, args);
  };

  next();
};