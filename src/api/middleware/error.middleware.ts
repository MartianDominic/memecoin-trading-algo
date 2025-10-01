// Error Handling Middleware - Centralized Error Management
import { Request, Response, NextFunction } from 'express';
import { Logger } from '../../utils/logger';
const logger = Logger.getInstance();
import { API_ERROR_CODES, ApiError } from '../types/api.types';

interface ErrorWithStatus extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
  details?: unknown;
}

// Custom error classes
export class ApiValidationError extends Error {
  public statusCode = 400;
  public code = API_ERROR_CODES.VALIDATION_ERROR;

  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'ApiValidationError';
  }
}

export class ApiNotFoundError extends Error {
  public statusCode = 404;
  public code = API_ERROR_CODES.NOT_FOUND;

  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'ApiNotFoundError';
  }
}

export class ApiUnauthorizedError extends Error {
  public statusCode = 401;
  public code = API_ERROR_CODES.UNAUTHORIZED;

  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'ApiUnauthorizedError';
  }
}

export class ApiForbiddenError extends Error {
  public statusCode = 403;
  public code = API_ERROR_CODES.FORBIDDEN;

  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ApiForbiddenError';
  }
}

export class ApiRateLimitError extends Error {
  public statusCode = 429;
  public code = API_ERROR_CODES.RATE_LIMIT_EXCEEDED;

  constructor(message: string = 'Rate limit exceeded') {
    super(message);
    this.name = 'ApiRateLimitError';
  }
}

export class ApiInternalError extends Error {
  public statusCode = 500;
  public code = API_ERROR_CODES.INTERNAL_ERROR;

  constructor(message: string = 'Internal server error', public details?: unknown) {
    super(message);
    this.name = 'ApiInternalError';
  }
}

export class ApiServiceUnavailableError extends Error {
  public statusCode = 503;
  public code = API_ERROR_CODES.SERVICE_UNAVAILABLE;

  constructor(message: string = 'Service temporarily unavailable') {
    super(message);
    this.name = 'ApiServiceUnavailableError';
  }
}

// Main error handler middleware
export const errorHandler = (
  error: ErrorWithStatus,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // If response already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(error);
  }

  // Extract error information
  let statusCode = error.statusCode || error.status || 500;
  let errorCode = error.code || API_ERROR_CODES.INTERNAL_ERROR;
  let message = error.message || 'An unexpected error occurred';
  let details = (error as ErrorWithStatus & { details?: unknown }).details;

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    errorCode = API_ERROR_CODES.VALIDATION_ERROR;
    message = 'Validation failed';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    errorCode = API_ERROR_CODES.VALIDATION_ERROR;
    message = 'Invalid data format';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = API_ERROR_CODES.INVALID_TOKEN;
    message = 'Invalid token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = API_ERROR_CODES.INVALID_TOKEN;
    message = 'Token expired';
  } else if (error.name === 'MulterError') {
    statusCode = 400;
    errorCode = API_ERROR_CODES.VALIDATION_ERROR;
    message = 'File upload error';
  }

  // Handle Prisma/Database errors
  if (error.code === 'P2002') {
    statusCode = 409;
    errorCode = API_ERROR_CODES.VALIDATION_ERROR;
    message = 'Duplicate entry';
  } else if (error.code === 'P2025') {
    statusCode = 404;
    errorCode = API_ERROR_CODES.NOT_FOUND;
    message = 'Record not found';
  }

  // Log error based on severity
  const logData = {
    requestId: (req as Request & { requestId?: string }).requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.headers['x-user-id'],
    statusCode,
    errorCode,
    message: error.message,
    stack: error.stack
  };

  if (statusCode >= 500) {
    logger.error('Internal server error', logData);
  } else if (statusCode >= 400) {
    logger.warn('Client error', {
      ...logData,
      stack: undefined // Don't log stack for client errors
    });
  }

  // Prepare error response
  const errorResponse: ApiError & {
    success: boolean;
    timestamp: string;
    version: string;
    requestId?: string;
  } = {
    success: false,
    code: errorCode,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  };

  // Add request ID if available
  const requestId = (req as Request & { requestId?: string }).requestId;
  if (requestId) {
    errorResponse.requestId = requestId;
  }

  // Include details in development mode or for validation errors
  if (
    process.env.NODE_ENV === 'development' ||
    errorCode === API_ERROR_CODES.VALIDATION_ERROR
  ) {
    if (details) {
      errorResponse.details = details;
    }

    // Include stack trace in development
    if (process.env.NODE_ENV === 'development' && error.stack) {
      errorResponse.details = {
        ...errorResponse.details,
        stack: error.stack
      };
    }
  }

  res.status(statusCode).json(errorResponse);
};

// Async error wrapper for route handlers
export const asyncHandler = <T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<void>
) => {
  return (req: T, res: U, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler for unmatched routes
export const notFoundHandler = (req: Request, res: Response): void => {
  const error: ApiError & { success: boolean; timestamp: string; version: string } = {
    success: false,
    code: API_ERROR_CODES.NOT_FOUND,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    statusCode: 404,
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  };

  logger.warn('Route not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json(error);
};

// Validation error helper
export const createValidationError = (message: string, details?: unknown): ApiValidationError => {
  return new ApiValidationError(message, details);
};

// Not found error helper
export const createNotFoundError = (resource: string = 'Resource'): ApiNotFoundError => {
  return new ApiNotFoundError(`${resource} not found`);
};

// Unauthorized error helper
export const createUnauthorizedError = (message?: string): ApiUnauthorizedError => {
  return new ApiUnauthorizedError(message);
};

// Forbidden error helper
export const createForbiddenError = (message?: string): ApiForbiddenError => {
  return new ApiForbiddenError(message);
};

// Rate limit error helper
export const createRateLimitError = (message?: string): ApiRateLimitError => {
  return new ApiRateLimitError(message);
};

// Internal error helper
export const createInternalError = (message?: string, details?: unknown): ApiInternalError => {
  return new ApiInternalError(message, details);
};

// Service unavailable error helper
export const createServiceUnavailableError = (message?: string): ApiServiceUnavailableError => {
  return new ApiServiceUnavailableError(message);
};

// Error reporting utilities
export const reportError = (error: Error, context?: Record<string, unknown>): void => {
  // In production, this could send to error tracking services like Sentry
  logger.error('Error reported', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    context,
    timestamp: new Date().toISOString()
  });
};

// Health check for error handling
export const getErrorStats = (): {
  totalErrors: number;
  errorsByType: Record<string, number>;
  recentErrors: number;
} => {
  // In production, this would aggregate from logs or metrics
  return {
    totalErrors: 0,
    errorsByType: {},
    recentErrors: 0
  };
};