import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { ZodError } from 'zod';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  error: ApiError | ZodError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const validationErrors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      received: err.input,
    }));

    logger.warn('Validation error:', {
      url: req.originalUrl,
      method: req.method,
      errors: validationErrors,
    });

    return res.status(400).json({
      error: 'Validation failed',
      details: validationErrors,
      timestamp: new Date().toISOString(),
    });
  }

  // Default error handling
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';
  const code = error.code || 'INTERNAL_ERROR';

  // Log error details
  logger.error('API Error:', {
    message: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    statusCode,
    code,
    ip: req.ip,
  });

  // Don't expose internal errors in production
  const isProduction = process.env.NODE_ENV === 'production';
  const responseMessage = isProduction && statusCode === 500
    ? 'Internal server error'
    : message;

  res.status(statusCode).json({
    error: responseMessage,
    code,
    timestamp: new Date().toISOString(),
    ...(isProduction ? {} : { stack: error.stack }),
  });
};

// Create custom API errors
export const createApiError = (message: string, statusCode: number = 500, code?: string): ApiError => {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.code = code;
  return error;
};