"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateWebhookSignature = exports.addRequestId = exports.validateFileSize = exports.requireJsonContent = exports.sanitizeInput = exports.validateHeaders = exports.validateParams = exports.validateBody = exports.validateQuery = exports.validateSortOptions = exports.validateTokenAddress = exports.validateDateRange = exports.validatePagination = exports.commonSchemas = exports.validate = void 0;
const zod_1 = require("zod");
const logger_1 = require("../../utils/logger");
const logger = logger_1.Logger.getInstance();
const api_types_1 = require("../types/api.types");
const validate = (schema, target = 'body', options = {}) => {
    return (req, res, next) => {
        try {
            const data = req[target];
            // Apply validation options
            let validationSchema = schema;
            if (options.stripUnknown && schema instanceof zod_1.z.ZodObject) {
                validationSchema = schema.strip();
            }
            if (options.strict && schema instanceof zod_1.z.ZodObject) {
                validationSchema = schema.strict();
            }
            // Validate the data
            const result = validationSchema.parse(data);
            // Replace the request data with validated/transformed data
            req[target] = result;
            logger.debug('Request validation successful', {
                target,
                path: req.path,
                method: req.method
            });
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
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
                    error: api_types_1.API_ERROR_CODES.VALIDATION_ERROR,
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
exports.validate = validate;
// Common validation schemas
exports.commonSchemas = {
    pagination: zod_1.z.object({
        page: zod_1.z.string().transform(val => parseInt(val, 10)).pipe(zod_1.z.number().min(1)).optional().default(1),
        limit: zod_1.z.string().transform(val => parseInt(val, 10)).pipe(zod_1.z.number().min(1).max(100)).optional().default(20)
    }),
    dateRange: zod_1.z.object({
        startDate: zod_1.z.string().datetime().optional(),
        endDate: zod_1.z.string().datetime().optional()
    }).refine(data => {
        if (data.startDate && data.endDate) {
            return new Date(data.startDate) <= new Date(data.endDate);
        }
        return true;
    }, {
        message: 'startDate must be before endDate'
    }),
    tokenAddress: zod_1.z.object({
        address: zod_1.z.string().min(1, 'Token address is required')
            .regex(/^[A-Za-z0-9]+$/, 'Invalid token address format')
    }),
    apiKey: zod_1.z.object({
        'x-api-key': zod_1.z.string().min(10, 'API key must be at least 10 characters').optional()
    }),
    sortOptions: zod_1.z.object({
        sortBy: zod_1.z.string().optional(),
        sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('desc')
    })
};
// Validation middleware factories for common patterns
exports.validatePagination = (0, exports.validate)(exports.commonSchemas.pagination, 'query');
exports.validateDateRange = (0, exports.validate)(exports.commonSchemas.dateRange, 'query');
exports.validateTokenAddress = (0, exports.validate)(exports.commonSchemas.tokenAddress, 'params');
exports.validateSortOptions = (0, exports.validate)(exports.commonSchemas.sortOptions, 'query');
// Combined validation middleware
const validateQuery = (schema, options) => (0, exports.validate)(schema, 'query', options);
exports.validateQuery = validateQuery;
const validateBody = (schema, options) => (0, exports.validate)(schema, 'body', options);
exports.validateBody = validateBody;
const validateParams = (schema, options) => (0, exports.validate)(schema, 'params', options);
exports.validateParams = validateParams;
const validateHeaders = (schema, options) => (0, exports.validate)(schema, 'headers', options);
exports.validateHeaders = validateHeaders;
// Sanitization middleware
const sanitizeInput = (req, res, next) => {
    // Recursively sanitize strings in request data
    const sanitizeObject = (obj) => {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                // Basic XSS prevention
                sanitized[key] = value
                    .replace(/[<>]/g, '') // Remove < and >
                    .replace(/javascript:/gi, '') // Remove javascript: protocol
                    .replace(/on\w+=/gi, '') // Remove onevent handlers
                    .trim();
            }
            else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                sanitized[key] = sanitizeObject(value);
            }
            else if (Array.isArray(value)) {
                sanitized[key] = value.map(item => typeof item === 'string' ? item.replace(/[<>]/g, '').trim() : item);
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    };
    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query);
    }
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
    }
    next();
};
exports.sanitizeInput = sanitizeInput;
// Content-Type validation
const requireJsonContent = (req, res, next) => {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        const contentType = req.headers['content-type'];
        if (!contentType || !contentType.includes('application/json')) {
            return res.status(400).json({
                success: false,
                error: api_types_1.API_ERROR_CODES.VALIDATION_ERROR,
                message: 'Content-Type must be application/json',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        }
    }
    next();
};
exports.requireJsonContent = requireJsonContent;
// File size validation for uploads
const validateFileSize = (maxSizeBytes) => {
    return (req, res, next) => {
        const contentLength = req.headers['content-length'];
        if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
            return res.status(413).json({
                success: false,
                error: api_types_1.API_ERROR_CODES.VALIDATION_ERROR,
                message: `Request body too large. Maximum size: ${maxSizeBytes} bytes`,
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        }
        next();
    };
};
exports.validateFileSize = validateFileSize;
// Request ID middleware (for tracking)
const addRequestId = (req, res, next) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    // Add to request object
    req.requestId = requestId;
    // Add to response headers
    res.set('X-Request-ID', requestId);
    next();
};
exports.addRequestId = addRequestId;
// Validate webhook signatures (if needed)
const validateWebhookSignature = (secret) => {
    return (req, res, next) => {
        const signature = req.headers['x-webhook-signature'];
        if (!signature) {
            return res.status(401).json({
                success: false,
                error: api_types_1.API_ERROR_CODES.UNAUTHORIZED,
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
                error: api_types_1.API_ERROR_CODES.UNAUTHORIZED,
                message: 'Invalid webhook signature',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        }
        next();
    };
};
exports.validateWebhookSignature = validateWebhookSignature;
//# sourceMappingURL=validation.middleware.js.map