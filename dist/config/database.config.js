"use strict";
/**
 * Database Configuration for Token Detection Pipeline
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseManager = exports.databaseConfig = void 0;
const pg_1 = require("pg");
const ioredis_1 = __importDefault(require("ioredis"));
exports.databaseConfig = {
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
class DatabaseManager {
    constructor() {
        this.pgPool = new pg_1.Pool({
            host: exports.databaseConfig.postgres.host,
            port: exports.databaseConfig.postgres.port,
            database: exports.databaseConfig.postgres.database,
            user: exports.databaseConfig.postgres.username,
            password: exports.databaseConfig.postgres.password,
            ssl: exports.databaseConfig.postgres.ssl,
            max: exports.databaseConfig.postgres.maxConnections,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
        this.redisClient = new ioredis_1.default({
            host: exports.databaseConfig.redis.host,
            port: exports.databaseConfig.redis.port,
            password: exports.databaseConfig.redis.password,
            db: exports.databaseConfig.redis.db,
            keyPrefix: exports.databaseConfig.redis.keyPrefix,
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 3,
        });
    }
    static getInstance() {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new DatabaseManager();
        }
        return DatabaseManager.instance;
    }
    getPostgresPool() {
        return this.pgPool;
    }
    getRedisClient() {
        return this.redisClient;
    }
    async healthCheck() {
        try {
            const [pgResult, redisResult] = await Promise.allSettled([
                this.pgPool.query('SELECT 1'),
                this.redisClient.ping()
            ]);
            return {
                postgres: pgResult.status === 'fulfilled',
                redis: redisResult.status === 'fulfilled' && redisResult.value === 'PONG'
            };
        }
        catch (error) {
            return { postgres: false, redis: false };
        }
    }
    async close() {
        await Promise.all([
            this.pgPool.end(),
            this.redisClient.quit()
        ]);
    }
}
exports.DatabaseManager = DatabaseManager;
//# sourceMappingURL=database.config.js.map