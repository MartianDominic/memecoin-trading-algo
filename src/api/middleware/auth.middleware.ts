// Authentication Middleware - API Key and User Authentication
import { Request, Response, NextFunction } from 'express';
import { Logger } from '../../utils/logger';
const logger = Logger.getInstance();
import { API_ERROR_CODES } from '../types/api.types';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    apiKey: string;
    tier: 'free' | 'premium' | 'enterprise';
    rateLimits: {
      requestsPerMinute: number;
      requestsPerHour: number;
    };
  };
}

// Mock API keys for development (in production, store in database)
const API_KEYS = new Map([
  ['dev_key_123', {
    id: 'user_1',
    name: 'Development User',
    tier: 'premium' as const,
    rateLimits: {
      requestsPerMinute: 100,
      requestsPerHour: 1000
    },
    isActive: true
  }],
  ['test_key_456', {
    id: 'user_2',
    name: 'Test User',
    tier: 'free' as const,
    rateLimits: {
      requestsPerMinute: 30,
      requestsPerHour: 300
    },
    isActive: true
  }]
]);

export interface ApiKeyData {
  id: string;
  name: string;
  tier: 'free' | 'premium' | 'enterprise';
  rateLimits: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  isActive: boolean;
}

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
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
      error: API_ERROR_CODES.INVALID_TOKEN,
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
      error: API_ERROR_CODES.UNAUTHORIZED,
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

export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: API_ERROR_CODES.UNAUTHORIZED,
      message: 'Authentication required',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  }

  next();
};

export const requireTier = (minTier: 'free' | 'premium' | 'enterprise') => {
  const tierLevels = { free: 0, premium: 1, enterprise: 2 };

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: API_ERROR_CODES.UNAUTHORIZED,
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
        error: API_ERROR_CODES.FORBIDDEN,
        message: `This endpoint requires ${minTier} tier or higher`,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    }

    next();
  };
};

function extractApiKey(req: Request): string | undefined {
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

function isPublicEndpoint(path: string): boolean {
  const publicPaths = [
    '/health',
    '/api/v1/health',
    '/api/v1',
    '/api/v1/docs'
  ];

  return publicPaths.includes(path) || path.startsWith('/api/v1/tokens'); // Tokens endpoints are public with optional auth
}

// Utility function to add new API key (for development)
export function addApiKey(apiKey: string, data: ApiKeyData): void {
  API_KEYS.set(apiKey, data);
  logger.info('API key added', {
    apiKey: apiKey.substring(0, 8) + '...',
    userId: data.id,
    tier: data.tier
  });
}

// Utility function to revoke API key
export function revokeApiKey(apiKey: string): boolean {
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
export function getApiKeyStats(): { total: number; active: number; byTier: Record<string, number> } {
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