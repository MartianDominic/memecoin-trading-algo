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
export declare const databaseConfig: DatabaseConfig;
export declare class DatabaseManager {
    private static instance;
    private pgPool;
    private redisClient;
    private constructor();
    static getInstance(): DatabaseManager;
    getPostgresPool(): Pool;
    getRedisClient(): Redis;
    healthCheck(): Promise<{
        postgres: boolean;
        redis: boolean;
    }>;
    close(): Promise<void>;
}
//# sourceMappingURL=database.config.d.ts.map