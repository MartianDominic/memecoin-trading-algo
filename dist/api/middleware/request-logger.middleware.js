"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsLogger = exports.rateLimitLogger = exports.securityLogger = exports.requestLogger = void 0;
const logger_1 = require("../../backend/src/config/logger");
// Request logging middleware
const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    req.startTime = startTime;
    // Generate request ID if not already set
    if (!req.requestId) {
        req.requestId = `req_${startTime}_${Math.random().toString(36).substr(2, 9)}`;
    }
    // Extract request information
    const requestData = {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl || req.url,
        path: req.path,
        query: req.query,
        ip: getClientIP(req),
        userAgent: req.get('User-Agent'),
        contentLength: req.get('Content-Length') ? parseInt(req.get('Content-Length'), 10) : undefined,
        userId: req.headers['x-user-id'],
        apiKey: req.headers['x-api-key'] ? maskApiKey(req.headers['x-api-key']) : undefined,
        startTime,
        timestamp: new Date().toISOString()
    };
    // Log request start (for debugging/development)
    if (process.env.NODE_ENV === 'development' && !isHealthCheck(req.path)) {
        logger_1.logger.debug('HTTP Request Started', requestData);
    }
    // Override res.end to capture response data
    const originalEnd = res.end;
    const originalWrite = res.write;
    let responseBody = '';
    let responseSize = 0;
    // Capture response body for logging (in development only)
    if (process.env.NODE_ENV === 'development') {
        res.write = function (chunk, ...args) {
            if (chunk) {
                responseBody += chunk.toString();
                responseSize += Buffer.byteLength(chunk.toString());
            }
            return originalWrite.call(this, chunk, ...args);
        };
    }
    res.end = function (chunk, ...args) {
        if (chunk) {
            if (process.env.NODE_ENV === 'development') {
                responseBody += chunk.toString();
            }
            responseSize += Buffer.byteLength(chunk.toString());
        }
        const duration = Date.now() - startTime;
        // Complete request log data
        const completeLogData = {
            ...requestData,
            duration,
            statusCode: res.statusCode,
            responseSize,
            timestamp: new Date().toISOString()
        };
        // Log request completion
        logRequestCompletion(completeLogData, responseBody);
        // Call original end method
        return originalEnd.call(this, chunk, ...args);
    };
    next();
};
exports.requestLogger = requestLogger;
// Log request completion with appropriate level
function logRequestCompletion(logData, responseBody) {
    const { statusCode, method, path, duration, ip, userId } = logData;
    // Skip health check logs in production
    if (isHealthCheck(path) && process.env.NODE_ENV === 'production') {
        return;
    }
    // Determine log level based on status code and duration
    let logLevel = 'info';
    let logMessage = `${method} ${path}`;
    if (statusCode >= 500) {
        logLevel = 'error';
        logMessage = `Server Error: ${logMessage}`;
    }
    else if (statusCode >= 400) {
        logLevel = 'warn';
        logMessage = `Client Error: ${logMessage}`;
    }
    else if (duration > 5000) {
        logLevel = 'warn';
        logMessage = `Slow Request: ${logMessage}`;
    }
    else if (statusCode >= 200 && statusCode < 300) {
        logMessage = `Success: ${logMessage}`;
    }
    // Prepare log data
    const logPayload = {
        ...logData,
        // Add performance categorization
        performance: categorizePerformance(duration),
        // Add sensitive data filtering
        query: filterSensitiveData(logData.query),
        // Add response body for errors in development
        ...(process.env.NODE_ENV === 'development' && statusCode >= 400 && responseBody && {
            responseBody: responseBody.length > 1000 ? responseBody.substring(0, 1000) + '...' : responseBody
        })
    };
    // Log with appropriate level
    logger_1.logger[logLevel](logMessage, logPayload);
    // Track metrics (in production, this could send to monitoring services)
    trackRequestMetrics(logData);
}
// Categorize request performance
function categorizePerformance(duration) {
    if (duration < 100)
        return 'fast';
    if (duration < 500)
        return 'normal';
    if (duration < 2000)
        return 'slow';
    if (duration < 5000)
        return 'very_slow';
    return 'timeout_risk';
}
// Filter sensitive data from logs
function filterSensitiveData(data) {
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'api_key'];
    const filtered = {};
    for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some(sensitiveKey => lowerKey.includes(sensitiveKey))) {
            filtered[key] = '[REDACTED]';
        }
        else if (typeof value === 'string' && value.length > 50) {
            // Truncate long strings
            filtered[key] = value.substring(0, 50) + '...';
        }
        else {
            filtered[key] = value;
        }
    }
    return filtered;
}
// Get client IP address
function getClientIP(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
        return ip.trim();
    }
    return req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
}
// Mask API key for logging
function maskApiKey(apiKey) {
    if (apiKey.length <= 8) {
        return '*'.repeat(apiKey.length);
    }
    return apiKey.substring(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.substring(apiKey.length - 4);
}
// Check if request is a health check
function isHealthCheck(path) {
    const healthPaths = ['/health', '/api/v1/health', '/ping', '/status'];
    return healthPaths.includes(path);
}
// Track request metrics (placeholder for monitoring integration)
function trackRequestMetrics(logData) {
    // In production, this could send metrics to:
    // - Prometheus
    // - StatsD
    // - CloudWatch
    // - New Relic
    // etc.
    const metrics = {
        'http_requests_total': 1,
        'http_request_duration_ms': logData.duration,
        'http_response_size_bytes': logData.responseSize,
        'http_requests_by_status': { [logData.statusCode]: 1 },
        'http_requests_by_method': { [logData.method]: 1 },
        'http_requests_by_path': { [logData.path]: 1 }
    };
    // Log metrics for debugging
    if (process.env.NODE_ENV === 'development') {
        logger_1.logger.debug('Request metrics', {
            requestId: logData.requestId,
            metrics
        });
    }
}
// Security logging middleware
const securityLogger = (req, res, next) => {
    // Log suspicious activities
    const suspiciousPatterns = [
        /\.\.\//, // Path traversal
        /<script/i, // XSS attempts
        /union.*select/i, // SQL injection
        /javascript:/i, // JavaScript protocol
    ];
    const url = req.originalUrl || req.url;
    const userAgent = req.get('User-Agent') || '';
    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(url) || pattern.test(userAgent) || pattern.test(JSON.stringify(req.body)));
    if (isSuspicious) {
        logger_1.logger.warn('Suspicious request detected', {
            ip: getClientIP(req),
            method: req.method,
            url,
            userAgent,
            body: req.body,
            headers: filterSensitiveData(req.headers),
            timestamp: new Date().toISOString()
        });
    }
    next();
};
exports.securityLogger = securityLogger;
// Rate limiting logger
const rateLimitLogger = (req, res, next) => {
    // This would typically be integrated with your rate limiting solution
    const rateLimitInfo = {
        ip: getClientIP(req),
        userId: req.headers['x-user-id'],
        path: req.path,
        timestamp: new Date().toISOString()
    };
    // Log rate limiting events (when limits are hit)
    res.on('finish', () => {
        if (res.statusCode === 429) {
            logger_1.logger.warn('Rate limit exceeded', rateLimitInfo);
        }
    });
    next();
};
exports.rateLimitLogger = rateLimitLogger;
// API usage analytics
const analyticsLogger = (req, res, next) => {
    // Track API usage patterns
    const usageData = {
        endpoint: req.path,
        method: req.method,
        userId: req.headers['x-user-id'],
        apiKey: req.headers['x-api-key'] ? maskApiKey(req.headers['x-api-key']) : undefined,
        timestamp: new Date().toISOString(),
        ip: getClientIP(req)
    };
    res.on('finish', () => {
        // Log successful API calls for analytics
        if (res.statusCode >= 200 && res.statusCode < 400) {
            logger_1.logger.info('API Usage', {
                ...usageData,
                statusCode: res.statusCode,
                responseTime: Date.now() - req.startTime
            });
        }
    });
    next();
};
exports.analyticsLogger = analyticsLogger;
//# sourceMappingURL=request-logger.middleware.js.map