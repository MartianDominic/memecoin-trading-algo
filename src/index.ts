/**
 * Main Entry Point for Memecoin Trading Algorithm
 * Orchestrates all services and components
 */

import dotenv from 'dotenv';
import { Logger } from './utils/logger';
import { DatabaseManager } from './config/database.config';
import { TokenAggregatorService } from './services/token-aggregator.service';
import { DexScreenerService } from './services/dexscreener.service';
import { RugCheckService } from './services/rugcheck.service';
import { JupiterService } from './services/jupiter.service';
import { SolscanService } from './services/solscan.service';
import { HealthCheckService } from './services/health-check.service';

// Load environment variables
dotenv.config();

class MemecoinTradingSystem {
  private readonly logger = Logger.getInstance();
  private readonly dbManager = DatabaseManager.getInstance();
  private aggregatorService: TokenAggregatorService;
  private healthService: HealthCheckService;

  constructor() {
    this.logger.info('Initializing Memecoin Trading Algorithm System');

    // Initialize API services
    const dexScreenerService = new DexScreenerService();
    const rugCheckService = new RugCheckService();
    const jupiterService = new JupiterService();
    const solscanService = new SolscanService();

    // Initialize aggregator with all services
    this.aggregatorService = new TokenAggregatorService(
      dexScreenerService,
      rugCheckService,
      jupiterService,
      solscanService
    );

    // Initialize health check service
    this.healthService = new HealthCheckService([
      dexScreenerService,
      rugCheckService,
      jupiterService,
      solscanService
    ]);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Set up aggregator event handlers
    this.aggregatorService.on('token:discovered', (token) => {
      this.logger.info(`New token discovered: ${token.symbol} (${token.address})`);
    });

    this.aggregatorService.on('token:passed', (analysis) => {
      this.logger.info(`🎯 High-quality token found: ${analysis.address} (Score: ${analysis.overallScore}/100)`);
    });

    this.aggregatorService.on('pipeline:error', (error) => {
      this.logger.error('Pipeline error:', error);
    });

    this.aggregatorService.on('stats:updated', (stats) => {
      this.logger.info(`Pipeline stats - Processed: ${stats.processed}, Passed: ${stats.passed}, Failed: ${stats.failed}`);
    });

    // Process termination handlers
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception:', { message: error.message, stack: error.stack });
      this.shutdown('UNCAUGHT_EXCEPTION');
    });
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled rejection', { reason, promise: String(promise) });
    });
  }

  public async start(): Promise<void> {
    try {
      this.logger.info('Starting Memecoin Trading Algorithm System...');

      // Check system health
      this.logger.info('Running health checks...');
      const healthStatus = await this.dbManager.healthCheck();

      if (!healthStatus.postgres) {
        throw new Error('Database connection failed');
      }

      if (!healthStatus.redis) {
        this.logger.warn('Redis connection failed - caching will be limited');
      }

      // Check external API health
      const apiHealth = await this.healthService.checkAllServices();
      this.logger.info('API Health Status:', { status: apiHealth });

      // Start the token aggregation service
      this.logger.info('Starting token aggregation service...');
      await this.aggregatorService.start();

      this.logger.info('🚀 Memecoin Trading Algorithm System is now running!');
      this.logger.info('📊 Token discovery and analysis will run every 5 minutes');
      this.logger.info('🎯 High-quality tokens will be automatically identified and logged');

      // Log system configuration
      this.logSystemConfiguration();

    } catch (error) {
      this.logger.error('Failed to start system:', { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    }
  }

  private logSystemConfiguration(): void {
    this.logger.info('System Configuration:');
    this.logger.info(`- Environment: ${process.env.NODE_ENV || 'development'}`);
    this.logger.info(`- Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    this.logger.info(`- Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
    this.logger.info('- Filter Criteria:');
    this.logger.info('  • Age: <24h, >30min');
    this.logger.info('  • Liquidity: >$5k');
    this.logger.info('  • Volume: >$1k');
    this.logger.info('  • Safety: ≥6/10, no honeypot');
    this.logger.info('  • Routing: exists, <10% slippage on $500');
    this.logger.info('  • Creator: <3 rugs, top 3 holders <60%');
  }

  private async shutdown(signal: string): Promise<void> {
    this.logger.info(`Received ${signal}. Shutting down gracefully...`);

    try {
      // Stop the aggregation service
      if (this.aggregatorService) {
        await this.aggregatorService.stop();
        this.logger.info('Token aggregation service stopped');
      }

      // Close database connections
      await this.dbManager.close();
      this.logger.info('Database connections closed');

      this.logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Main execution
async function main(): Promise<void> {
  const system = new MemecoinTradingSystem();
  await system.start();
}

// Start the system
if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to start system:', error);
    process.exit(1);
  });
}

export { MemecoinTradingSystem };