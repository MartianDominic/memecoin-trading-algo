// Main configuration file
import dotenv from 'dotenv';
import { ApiConfig, TradingConfig } from '../types';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Server configuration
export const serverConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  wsPort: parseInt(process.env.WS_PORT || '3001', 10),
} as const;

// Security configuration
export const securityConfig = {
  jwtSecret: process.env.JWT_SECRET!,
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
} as const;

// Redis configuration
export const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || '',
} as const;

// External API configuration
export const apiConfig: ApiConfig = {
  dexscreener: {
    baseUrl: 'https://api.dexscreener.com/latest',
    apiKey: process.env.DEXSCREENER_API_KEY,
    rateLimit: 300, // requests per minute
  },
  gmgn: {
    baseUrl: 'https://gmgn.ai/defi/quotation/v1',
    apiKey: process.env.GMGN_API_KEY,
    rateLimit: 100, // requests per minute
  },
  geckoterminal: {
    baseUrl: 'https://api.geckoterminal.com/api/v2',
    apiKey: process.env.GECKOTERMINAL_API_KEY,
    rateLimit: 30, // requests per minute (free tier)
  },
  solscan: {
    baseUrl: 'https://public-api.solscan.io',
    apiKey: process.env.SOLSCAN_API_KEY,
    rateLimit: 40, // requests per minute (free tier)
  },
} as const;

// Trading configuration
export const tradingConfig: TradingConfig = {
  maxPositionSizeUsd: parseFloat(process.env.MAX_POSITION_SIZE_USD || '1000'),
  stopLossPercentage: parseFloat(process.env.STOP_LOSS_PERCENTAGE || '0.15'),
  takeProfitPercentage: parseFloat(process.env.TAKE_PROFIT_PERCENTAGE || '0.30'),
  maxConcurrentTrades: parseInt(process.env.MAX_CONCURRENT_TRADES || '5', 10),
  safetyScoreThreshold: parseFloat(process.env.SAFETY_SCORE_THRESHOLD || '7.0'),
  volumeThresholdUsd: parseFloat(process.env.VOLUME_THRESHOLD_USD || '10000'),
  marketCapMinUsd: parseFloat(process.env.MARKET_CAP_MIN_USD || '50000'),
  marketCapMaxUsd: parseFloat(process.env.MARKET_CAP_MAX_USD || '10000000'),
  tokenScanIntervalMs: parseInt(process.env.TOKEN_SCAN_INTERVAL_MS || '30000', 10),
  maxTokensPerScan: parseInt(process.env.MAX_TOKENS_PER_SCAN || '100', 10),
} as const;

// Logging configuration
export const loggingConfig = {
  level: process.env.LOG_LEVEL || 'info',
  filePath: process.env.LOG_FILE_PATH || './logs/app.log',
} as const;

// CORS configuration
export const corsConfig = {
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.API_BASE_URL || 'http://localhost:3000']
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
  credentials: true,
  optionsSuccessStatus: 200,
} as const;

// Health check configuration
export const healthConfig = {
  checkIntervalMs: 30000, // 30 seconds
  unhealthyThreshold: 3, // Number of failed checks before marking unhealthy
} as const;

// Export all configurations
export const config = {
  server: serverConfig,
  security: securityConfig,
  redis: redisConfig,
  api: apiConfig,
  trading: tradingConfig,
  logging: loggingConfig,
  cors: corsConfig,
  health: healthConfig,
} as const;

export default config;