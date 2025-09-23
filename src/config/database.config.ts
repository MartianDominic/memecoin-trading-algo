/**
 * Database Configuration for Token Detection Pipeline
 */

import { Pool } from 'pg';
import Redis from 'ioredis';

export interface DatabaseConfig {
  postgres: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
    maxConnections: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
  };
}

export const databaseConfig: DatabaseConfig = {
  postgres: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'token_detection',
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.NODE_ENV === 'production',
    maxConnections: 20
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: 'token_detection:'
  }
};

export class DatabaseManager {
  private static instance: DatabaseManager;
  private pgPool: Pool;
  private redisClient: Redis;

  private constructor() {
    this.pgPool = new Pool({
      host: databaseConfig.postgres.host,
      port: databaseConfig.postgres.port,
      database: databaseConfig.postgres.database,
      user: databaseConfig.postgres.username,
      password: databaseConfig.postgres.password,
      ssl: databaseConfig.postgres.ssl,
      max: databaseConfig.postgres.maxConnections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.redisClient = new Redis({
      host: databaseConfig.redis.host,
      port: databaseConfig.redis.port,
      password: databaseConfig.redis.password,
      db: databaseConfig.redis.db,
      keyPrefix: databaseConfig.redis.keyPrefix,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public getPostgresPool(): Pool {
    return this.pgPool;
  }

  public getRedisClient(): Redis {
    return this.redisClient;
  }

  public async healthCheck(): Promise<{ postgres: boolean; redis: boolean }> {
    try {
      const [pgResult, redisResult] = await Promise.allSettled([
        this.pgPool.query('SELECT 1'),
        this.redisClient.ping()
      ]);

      return {
        postgres: pgResult.status === 'fulfilled',
        redis: redisResult.status === 'fulfilled' && redisResult.value === 'PONG'
      };
    } catch (error) {
      return { postgres: false, redis: false };
    }
  }

  public async close(): Promise<void> {
    await Promise.all([
      this.pgPool.end(),
      this.redisClient.quit()
    ]);
  }
}