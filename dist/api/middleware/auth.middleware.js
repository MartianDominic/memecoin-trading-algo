"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireTier = exports.requireAuth = exports.authMiddleware = void 0;
exports.addApiKey = addApiKey;
exports.revokeApiKey = revokeApiKey;
exports.getApiKeyStats = getApiKeyStats;
const logger_1 = require("../../utils/logger");
const logger = logger_1.Logger.getInstance();
const api_types_1 = require("../types/api.types");
// Mock API keys for development (in production, store in database)
const API_KEYS = new Map([
    ['dev_key_123', {
            id: 'user_1',
            name: 'Development User',
            tier: 'premium',
            rateLimits: {
                requestsPerMinute: 100,
                requestsPerHour: 1000
            },
            isActive: true
        }],
    ['test_key_456', {
            id: 'user_2',
            name: 'Test User',
            tier: 'free',
            rateLimits: {
                requestsPerMinute: 30,
                requestsPerHour: 300
            },
            isActive: true
        }]
]);
const authMiddleware = (req, res, next) => {
    // Skip auth for health checks and public endpoints
    if (isPublicEndpoint(req.path)) {
        return next();
    }
    const apiKey = extractApiKey(req);
    if (!apiKey) {
        // API key is optional for most endpoints, but some features require authentication
        logger.info('Request without API key', {
            path: req.path,
            method: req.method,
            ip: req.ip
        });
        return next();
    }
    const keyData = API_KEYS.get(apiKey);
    if (!keyData) {
        logger.warn('Invalid API key used', {
            apiKey: apiKey.substring(0, 8) + '...',
            path: req.path,
            ip: req.ip
        });
        return res.status(401).json({
            success: false,
            error: api_types_1.API_ERROR_CODES.INVALID_TOKEN,
            message: 'Invalid API key',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    }
    if (!keyData.isActive) {
        logger.warn('Inactive API key used', {
            userId: keyData.id,
            path: req.path,
            ip: req.ip
        });
        return res.status(401).json({
            success: false,
            error: api_types_1.API_ERROR_CODES.UNAUTHORIZED,
            message: 'API key is inactive',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    }
    // Attach user info to request
    req.user = {
        id: keyData.id,
        apiKey,
        tier: keyData.tier,
        rateLimits: keyData.rateLimits
    };
    // Set user ID header for other middleware
    req.headers['x-user-id'] = keyData.id;
    logger.info('Authenticated request', {
        userId: keyData.id,
        tier: keyData.tier,
        path: req.path,
        method: req.method
    });
    next();
};
exports.authMiddleware = authMiddleware;
const requireAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: api_types_1.API_ERROR_CODES.UNAUTHORIZED,
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    }
    next();
};
exports.requireAuth = requireAuth;
const requireTier = (minTier) => {
    const tierLevels = { free: 0, premium: 1, enterprise: 2 };
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: api_types_1.API_ERROR_CODES.UNAUTHORIZED,
                message: 'Authentication required',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        }
        const userTierLevel = tierLevels[req.user.tier];
        const requiredTierLevel = tierLevels[minTier];
        if (userTierLevel < requiredTierLevel) {
            return res.status(403).json({
                success: false,
                error: api_types_1.API_ERROR_CODES.FORBIDDEN,
                message: `This endpoint requires ${minTier} tier or higher`,
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        }
        next();
    };
};
exports.requireTier = requireTier;
function extractApiKey(req) {
    // Check X-API-Key header
    const headerKey = req.headers['x-api-key'];
    if (headerKey && typeof headerKey === 'string') {
        return headerKey;
    }
    // Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    // Check query parameter (not recommended for production)
    const queryKey = req.query.api_key;
    if (queryKey && typeof queryKey === 'string') {
        return queryKey;
    }
    return undefined;
}
function isPublicEndpoint(path) {
    const publicPaths = [
        '/health',
        '/api/v1/health',
        '/api/v1',
        '/api/v1/docs'
    ];
    return publicPaths.includes(path) || path.startsWith('/api/v1/tokens'); // Tokens endpoints are public with optional auth
}
// Utility function to add new API key (for development)
function addApiKey(apiKey, data) {
    API_KEYS.set(apiKey, data);
    logger.info('API key added', {
        apiKey: apiKey.substring(0, 8) + '...',
        userId: data.id,
        tier: data.tier
    });
}
// Utility function to revoke API key
function revokeApiKey(apiKey) {
    const keyData = API_KEYS.get(apiKey);
    if (keyData) {
        keyData.isActive = false;
        logger.info('API key revoked', {
            apiKey: apiKey.substring(0, 8) + '...',
            userId: keyData.id
        });
        return true;
    }
    return false;
}
// Utility function to get API key stats
function getApiKeyStats() {
    const stats = {
        total: API_KEYS.size,
        active: 0,
        byTier: { free: 0, premium: 0, enterprise: 0 }
    };
    API_KEYS.forEach(keyData => {
        if (keyData.isActive) {
            stats.active++;
        }
        stats.byTier[keyData.tier]++;
    });
    return stats;
}
//# sourceMappingURL=auth.middleware.js.map