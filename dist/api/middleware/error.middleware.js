"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorStats = exports.reportError = exports.createServiceUnavailableError = exports.createInternalError = exports.createRateLimitError = exports.createForbiddenError = exports.createUnauthorizedError = exports.createNotFoundError = exports.createValidationError = exports.notFoundHandler = exports.asyncHandler = exports.errorHandler = exports.ApiServiceUnavailableError = exports.ApiInternalError = exports.ApiRateLimitError = exports.ApiForbiddenError = exports.ApiUnauthorizedError = exports.ApiNotFoundError = exports.ApiValidationError = void 0;
const logger_1 = require("../../backend/src/config/logger");
const api_types_1 = require("../types/api.types");
// Custom error classes
class ApiValidationError extends Error {
    constructor(message, details) {
        super(message);
        this.details = details;
        this.statusCode = 400;
        this.code = api_types_1.API_ERROR_CODES.VALIDATION_ERROR;
        this.name = 'ApiValidationError';
    }
}
exports.ApiValidationError = ApiValidationError;
class ApiNotFoundError extends Error {
    constructor(message = 'Resource not found') {
        super(message);
        this.statusCode = 404;
        this.code = api_types_1.API_ERROR_CODES.NOT_FOUND;
        this.name = 'ApiNotFoundError';
    }
}
exports.ApiNotFoundError = ApiNotFoundError;
class ApiUnauthorizedError extends Error {
    constructor(message = 'Unauthorized') {
        super(message);
        this.statusCode = 401;
        this.code = api_types_1.API_ERROR_CODES.UNAUTHORIZED;
        this.name = 'ApiUnauthorizedError';
    }
}
exports.ApiUnauthorizedError = ApiUnauthorizedError;
class ApiForbiddenError extends Error {
    constructor(message = 'Forbidden') {
        super(message);
        this.statusCode = 403;
        this.code = api_types_1.API_ERROR_CODES.FORBIDDEN;
        this.name = 'ApiForbiddenError';
    }
}
exports.ApiForbiddenError = ApiForbiddenError;
class ApiRateLimitError extends Error {
    constructor(message = 'Rate limit exceeded') {
        super(message);
        this.statusCode = 429;
        this.code = api_types_1.API_ERROR_CODES.RATE_LIMIT_EXCEEDED;
        this.name = 'ApiRateLimitError';
    }
}
exports.ApiRateLimitError = ApiRateLimitError;
class ApiInternalError extends Error {
    constructor(message = 'Internal server error', details) {
        super(message);
        this.details = details;
        this.statusCode = 500;
        this.code = api_types_1.API_ERROR_CODES.INTERNAL_ERROR;
        this.name = 'ApiInternalError';
    }
}
exports.ApiInternalError = ApiInternalError;
class ApiServiceUnavailableError extends Error {
    constructor(message = 'Service temporarily unavailable') {
        super(message);
        this.statusCode = 503;
        this.code = api_types_1.API_ERROR_CODES.SERVICE_UNAVAILABLE;
        this.name = 'ApiServiceUnavailableError';
    }
}
exports.ApiServiceUnavailableError = ApiServiceUnavailableError;
// Main error handler middleware
const errorHandler = (error, req, res, next) => {
    // If response already sent, delegate to default Express error handler
    if (res.headersSent) {
        return next(error);
    }
    // Extract error information
    let statusCode = error.statusCode || error.status || 500;
    let errorCode = error.code || api_types_1.API_ERROR_CODES.INTERNAL_ERROR;
    let message = error.message || 'An unexpected error occurred';
    let details = error.details;
    // Handle specific error types
    if (error.name === 'ValidationError') {
        statusCode = 400;
        errorCode = api_types_1.API_ERROR_CODES.VALIDATION_ERROR;
        message = 'Validation failed';
    }
    else if (error.name === 'CastError') {
        statusCode = 400;
        errorCode = api_types_1.API_ERROR_CODES.VALIDATION_ERROR;
        message = 'Invalid data format';
    }
    else if (error.name === 'JsonWebTokenError') {
        statusCode = 401;
        errorCode = api_types_1.API_ERROR_CODES.INVALID_TOKEN;
        message = 'Invalid token';
    }
    else if (error.name === 'TokenExpiredError') {
        statusCode = 401;
        errorCode = api_types_1.API_ERROR_CODES.INVALID_TOKEN;
        message = 'Token expired';
    }
    else if (error.name === 'MulterError') {
        statusCode = 400;
        errorCode = api_types_1.API_ERROR_CODES.VALIDATION_ERROR;
        message = 'File upload error';
    }
    // Handle Prisma/Database errors
    if (error.code === 'P2002') {
        statusCode = 409;
        errorCode = api_types_1.API_ERROR_CODES.VALIDATION_ERROR;
        message = 'Duplicate entry';
    }
    else if (error.code === 'P2025') {
        statusCode = 404;
        errorCode = api_types_1.API_ERROR_CODES.NOT_FOUND;
        message = 'Record not found';
    }
    // Log error based on severity
    const logData = {
        requestId: req.requestId,
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
        logger_1.logger.error('Internal server error', logData);
    }
    else if (statusCode >= 400) {
        logger_1.logger.warn('Client error', {
            ...logData,
            stack: undefined // Don't log stack for client errors
        });
    }
    // Prepare error response
    const errorResponse = {
        success: false,
        code: errorCode,
        message,
        statusCode,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    };
    // Add request ID if available
    const requestId = req.requestId;
    if (requestId) {
        errorResponse.requestId = requestId;
    }
    // Include details in development mode or for validation errors
    if (process.env.NODE_ENV === 'development' ||
        errorCode === api_types_1.API_ERROR_CODES.VALIDATION_ERROR) {
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
exports.errorHandler = errorHandler;
// Async error wrapper for route handlers
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
// 404 handler for unmatched routes
const notFoundHandler = (req, res) => {
    const error = {
        success: false,
        code: api_types_1.API_ERROR_CODES.NOT_FOUND,
        message: `Route ${req.method} ${req.originalUrl} not found`,
        statusCode: 404,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    };
    logger_1.logger.warn('Route not found', {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    res.status(404).json(error);
};
exports.notFoundHandler = notFoundHandler;
// Validation error helper
const createValidationError = (message, details) => {
    return new ApiValidationError(message, details);
};
exports.createValidationError = createValidationError;
// Not found error helper
const createNotFoundError = (resource = 'Resource') => {
    return new ApiNotFoundError(`${resource} not found`);
};
exports.createNotFoundError = createNotFoundError;
// Unauthorized error helper
const createUnauthorizedError = (message) => {
    return new ApiUnauthorizedError(message);
};
exports.createUnauthorizedError = createUnauthorizedError;
// Forbidden error helper
const createForbiddenError = (message) => {
    return new ApiForbiddenError(message);
};
exports.createForbiddenError = createForbiddenError;
// Rate limit error helper
const createRateLimitError = (message) => {
    return new ApiRateLimitError(message);
};
exports.createRateLimitError = createRateLimitError;
// Internal error helper
const createInternalError = (message, details) => {
    return new ApiInternalError(message, details);
};
exports.createInternalError = createInternalError;
// Service unavailable error helper
const createServiceUnavailableError = (message) => {
    return new ApiServiceUnavailableError(message);
};
exports.createServiceUnavailableError = createServiceUnavailableError;
// Error reporting utilities
const reportError = (error, context) => {
    // In production, this could send to error tracking services like Sentry
    logger_1.logger.error('Error reported', {
        error: {
            name: error.name,
            message: error.message,
            stack: error.stack
        },
        context,
        timestamp: new Date().toISOString()
    });
};
exports.reportError = reportError;
// Health check for error handling
const getErrorStats = () => {
    // In production, this would aggregate from logs or metrics
    return {
        totalErrors: 0,
        errorsByType: {},
        recentErrors: 0
    };
};
exports.getErrorStats = getErrorStats;
//# sourceMappingURL=error.middleware.js.map