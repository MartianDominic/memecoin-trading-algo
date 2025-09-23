// Validation Middleware - Request Validation with Zod
import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { logger } from '../../backend/src/config/logger';
import { API_ERROR_CODES } from '../types/api.types';

type ValidationTarget = 'body' | 'query' | 'params' | 'headers';

interface ValidationOptions {
  strict?: boolean; // If true, unknown properties will cause validation to fail
  stripUnknown?: boolean; // If true, unknown properties will be removed
  errorMessage?: string; // Custom error message
}

export const validate = (
  schema: ZodSchema,
  target: ValidationTarget = 'body',
  options: ValidationOptions = {}
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[target];

      // Apply validation options
      let validationSchema = schema;

      if (options.stripUnknown && schema instanceof z.ZodObject) {
        validationSchema = schema.strip();
      }

      if (options.strict && schema instanceof z.ZodObject) {
        validationSchema = schema.strict();
      }

      // Validate the data
      const result = validationSchema.parse(data);

      // Replace the request data with validated/transformed data
      (req as Record<string, unknown>)[target] = result;

      logger.debug('Request validation successful', {
        target,
        path: req.path,
        method: req.method
      });

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
          received: err.received
        }));

        logger.warn('Request validation failed', {
          target,
          path: req.path,
          method: req.method,
          errors: validationErrors
        });

        return res.status(400).json({
          success: false,
          error: API_ERROR_CODES.VALIDATION_ERROR,
          message: options.errorMessage || `Invalid ${target} data`,
          details: validationErrors,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        });
      }

      // Re-throw non-validation errors
      throw error;
    }
  };
};

// Common validation schemas
export const commonSchemas = {
  pagination: z.object({
    page: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1)).optional().default(1),
    limit: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1).max(100)).optional().default(20)
  }),

  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
  }).refine(data => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  }, {
    message: 'startDate must be before endDate'
  }),

  tokenAddress: z.object({
    address: z.string().min(1, 'Token address is required')
      .regex(/^[A-Za-z0-9]+$/, 'Invalid token address format')
  }),

  apiKey: z.object({
    'x-api-key': z.string().min(10, 'API key must be at least 10 characters').optional()
  }),

  sortOptions: z.object({
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
  })
};

// Validation middleware factories for common patterns
export const validatePagination = validate(commonSchemas.pagination, 'query');

export const validateDateRange = validate(commonSchemas.dateRange, 'query');

export const validateTokenAddress = validate(commonSchemas.tokenAddress, 'params');

export const validateSortOptions = validate(commonSchemas.sortOptions, 'query');

// Combined validation middleware
export const validateQuery = (schema: ZodSchema, options?: ValidationOptions) =>
  validate(schema, 'query', options);

export const validateBody = (schema: ZodSchema, options?: ValidationOptions) =>
  validate(schema, 'body', options);

export const validateParams = (schema: ZodSchema, options?: ValidationOptions) =>
  validate(schema, 'params', options);

export const validateHeaders = (schema: ZodSchema, options?: ValidationOptions) =>
  validate(schema, 'headers', options);

// Sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Recursively sanitize strings in request data
  const sanitizeObject = (obj: Record<string, unknown>): Record<string, unknown> => {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Basic XSS prevention
        sanitized[key] = value
          .replace(/[<>]/g, '') // Remove < and >
          .replace(/javascript:/gi, '') // Remove javascript: protocol
          .replace(/on\w+=/gi, '') // Remove onevent handlers
          .trim();
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = sanitizeObject(value as Record<string, unknown>);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item =>
          typeof item === 'string' ? item.replace(/[<>]/g, '').trim() : item
        );
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  };

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query as Record<string, unknown>);
  }

  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  next();
};

// Content-Type validation
export const requireJsonContent = (req: Request, res: Response, next: NextFunction): void => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const contentType = req.headers['content-type'];

    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({
        success: false,
        error: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'Content-Type must be application/json',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    }
  }

  next();
};

// File size validation for uploads
export const validateFileSize = (maxSizeBytes: number) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.headers['content-length'];

    if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
      return res.status(413).json({
        success: false,
        error: API_ERROR_CODES.VALIDATION_ERROR,
        message: `Request body too large. Maximum size: ${maxSizeBytes} bytes`,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    }

    next();
  };
};

// Request ID middleware (for tracking)
export const addRequestId = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Add to request object
  (req as Request & { requestId: string }).requestId = requestId;

  // Add to response headers
  res.set('X-Request-ID', requestId);

  next();
};

// Validate webhook signatures (if needed)
export const validateWebhookSignature = (secret: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const signature = req.headers['x-webhook-signature'] as string;

    if (!signature) {
      return res.status(401).json({
        success: false,
        error: API_ERROR_CODES.UNAUTHORIZED,
        message: 'Missing webhook signature',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    }

    // In production, implement actual signature validation
    // This is a simplified version
    const expectedSignature = `sha256=${require('crypto')
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex')}`;

    if (signature !== expectedSignature) {
      return res.status(401).json({
        success: false,
        error: API_ERROR_CODES.UNAUTHORIZED,
        message: 'Invalid webhook signature',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    }

    next();
  };
};