import dotenv from 'dotenv';
import { z } from 'zod';
import { logger } from './logger';

// Load environment variables
dotenv.config();

// Environment validation schema
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url('Invalid DATABASE_URL'),

  // Server
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // API Keys (optional in development)
  DEXSCREENER_API_KEY: z.string().optional(),
  JUPITER_API_KEY: z.string().optional(),
  SOLSCAN_API_KEY: z.string().optional(),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

  // Redis (optional)
  REDIS_URL: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE: z.string().default('logs/app.log'),

  // Token Detection
  DETECTION_INTERVAL_MINUTES: z.string().transform(Number).default('5'),
  MIN_LIQUIDITY_USD: z.string().transform(Number).default('5000'),
  MIN_VOLUME_USD: z.string().transform(Number).default('1000'),
  MIN_SAFETY_SCORE: z.string().transform(Number).default('6'),
  MAX_TOKEN_AGE_HOURS: z.string().transform(Number).default('24'),

  // WebSocket
  WS_PORT: z.string().transform(Number).default('3002'),
  WS_HEARTBEAT_INTERVAL: z.string().transform(Number).default('30000'),

  // Solana RPC
  SOLANA_RPC_URL: z.string().url().default('https://api.mainnet-beta.solana.com'),
  SOLANA_RPC_WS: z.string().url().default('wss://api.mainnet-beta.solana.com'),
});

// Validate and parse environment
let env: z.infer<typeof envSchema>;

try {
  env = envSchema.parse(process.env);
  logger.info('Environment variables validated successfully');
} catch (error) {
  if (error instanceof z.ZodError) {
    logger.error('Environment validation failed:', {
      errors: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        received: err.input
      }))
    });
  }
  process.exit(1);
}

// Export configuration object
export const config = {
  // Database
  database: {
    url: env.DATABASE_URL,
  },

  // Server
  server: {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
  },

  // API Keys
  apiKeys: {
    dexscreener: env.DEXSCREENER_API_KEY,
    jupiter: env.JUPITER_API_KEY,
    solscan: env.SOLSCAN_API_KEY,
  },

  // Rate Limiting
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },

  // Redis
  redis: {
    url: env.REDIS_URL,
    password: env.REDIS_PASSWORD,
  },

  // Logging
  logging: {
    level: env.LOG_LEVEL,
    file: env.LOG_FILE,
  },

  // Token Detection
  detection: {
    intervalMinutes: env.DETECTION_INTERVAL_MINUTES,
    minLiquidityUsd: env.MIN_LIQUIDITY_USD,
    minVolumeUsd: env.MIN_VOLUME_USD,
    minSafetyScore: env.MIN_SAFETY_SCORE,
    maxTokenAgeHours: env.MAX_TOKEN_AGE_HOURS,
  },

  // WebSocket
  websocket: {
    port: env.WS_PORT,
    heartbeatInterval: env.WS_HEARTBEAT_INTERVAL,
  },

  // Solana
  solana: {
    rpcUrl: env.SOLANA_RPC_URL,
    rpcWs: env.SOLANA_RPC_WS,
  },

  // Computed values
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
} as const;

export default config;