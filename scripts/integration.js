#!/usr/bin/env node

/**
 * Integration Script for Memecoin Trading Algorithm
 * Connects all services into a working pipeline with proper error handling
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn, exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

// Configuration
const CONFIG = {
  services: {
    database: { port: 5432, name: 'PostgreSQL' },
    redis: { port: 6379, name: 'Redis' },
    api: { port: 3000, name: 'Backend API' },
    websocket: { port: 3002, name: 'WebSocket Server' },
    frontend: { port: 3001, name: 'Frontend' }
  },
  timeouts: {
    service_start: 30000,
    health_check: 5000,
    integration_test: 120000
  },
  paths: {
    backend: './backend',
    frontend: './frontend',
    logs: './logs',
    config: './config'
  }
};

// Color output utilities
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  step: (msg) => console.log(`${colors.magenta}[STEP]${colors.reset} ${msg}`)
};

// Service management
class ServiceManager {
  constructor() {
    this.processes = new Map();
    this.healthChecks = new Map();
  }

  async startService(name, command, cwd = '.', env = {}) {
    log.info(`Starting ${name}...`);

    return new Promise((resolve, reject) => {
      const process = spawn('npm', ['run', command], {
        cwd,
        env: { ...process.env, ...env },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.processes.set(name, process);

      // Create log files
      const logFile = path.join(CONFIG.paths.logs, `${name.toLowerCase()}.log`);
      const logStream = require('fs').createWriteStream(logFile, { flags: 'a' });

      process.stdout.pipe(logStream);
      process.stderr.pipe(logStream);

      // Handle process events
      process.on('error', (error) => {
        log.error(`Failed to start ${name}: ${error.message}`);
        reject(error);
      });

      process.on('exit', (code) => {
        if (code !== 0) {
          log.error(`${name} exited with code ${code}`);
        }
        this.processes.delete(name);
      });

      // Give the service time to start
      setTimeout(() => {
        if (this.processes.has(name)) {
          log.success(`${name} started successfully`);
          resolve(process);
        } else {
          reject(new Error(`${name} failed to start`));
        }
      }, 5000);
    });
  }

  async stopService(name) {
    const process = this.processes.get(name);
    if (process) {
      log.info(`Stopping ${name}...`);
      process.kill('SIGTERM');

      // Force kill after 10 seconds
      setTimeout(() => {
        if (this.processes.has(name)) {
          process.kill('SIGKILL');
        }
      }, 10000);

      this.processes.delete(name);
      log.success(`${name} stopped`);
    }
  }

  async stopAll() {
    log.info('Stopping all services...');
    const stopPromises = Array.from(this.processes.keys()).map(name =>
      this.stopService(name)
    );
    await Promise.all(stopPromises);
  }

  isRunning(name) {
    return this.processes.has(name);
  }
}

// Health check utilities
class HealthChecker {
  async checkPort(port, timeout = 5000) {
    const net = require('net');

    return new Promise((resolve) => {
      const socket = new net.Socket();

      const onError = () => {
        socket.destroy();
        resolve(false);
      };

      socket.setTimeout(timeout);
      socket.once('error', onError);
      socket.once('timeout', onError);

      socket.connect(port, '127.0.0.1', () => {
        socket.end();
        resolve(true);
      });
    });
  }

  async checkHttp(url, timeout = 5000) {
    const https = require('https');
    const http = require('http');

    return new Promise((resolve) => {
      const request = (url.startsWith('https:') ? https : http).get(url, {
        timeout
      }, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });

      request.on('error', () => resolve(false));
      request.on('timeout', () => {
        request.destroy();
        resolve(false);
      });
    });
  }

  async checkDatabase() {
    try {
      await execAsync('pg_isready -h localhost -p 5432');
      return true;
    } catch {
      return false;
    }
  }

  async checkRedis() {
    try {
      await execAsync('redis-cli ping');
      return true;
    } catch {
      return false;
    }
  }

  async waitForService(name, checkFn, timeout = 30000) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (await checkFn()) {
        log.success(`${name} is ready`);
        return true;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    log.error(`${name} failed to become ready within ${timeout}ms`);
    return false;
  }
}

// Environment setup
class EnvironmentManager {
  async createDirectories() {
    const dirs = [
      CONFIG.paths.logs,
      'tests/coverage',
      'tests/reports'
    ];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
        log.info(`Created directory: ${dir}`);
      } catch (error) {
        if (error.code !== 'EEXIST') {
          log.error(`Failed to create directory ${dir}: ${error.message}`);
        }
      }
    }
  }

  async setupEnvironment() {
    log.step('Setting up environment...');

    // Create .env file if it doesn't exist
    const envPath = '.env';
    try {
      await fs.access(envPath);
      log.info('.env file already exists');
    } catch {
      const envContent = `
# Development Environment
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/memecoin_trading
REDIS_URL=redis://localhost:6379

# API Configuration
DEXSCREENER_BASE_URL=https://api.dexscreener.com/latest
RUGCHECK_BASE_URL=https://api.rugcheck.xyz
JUPITER_BASE_URL=https://quote-api.jup.ag/v6
SOLSCAN_BASE_URL=https://api.solscan.io

# WebSocket
WS_PORT=3002

# Security
JWT_SECRET=development-secret-change-in-production

# Features
ENABLE_SAFETY_ANALYSIS=true
ENABLE_REAL_TIME_UPDATES=true
`;

      await fs.writeFile(envPath, envContent.trim());
      log.success('Created .env file');
    }

    await this.createDirectories();
  }

  async installDependencies() {
    log.step('Installing dependencies...');

    // Backend dependencies
    if (await this.directoryExists(CONFIG.paths.backend)) {
      log.info('Installing backend dependencies...');
      await execAsync('npm install', { cwd: CONFIG.paths.backend });
      log.success('Backend dependencies installed');
    }

    // Frontend dependencies
    if (await this.directoryExists(CONFIG.paths.frontend)) {
      log.info('Installing frontend dependencies...');
      await execAsync('npm install', { cwd: CONFIG.paths.frontend });
      log.success('Frontend dependencies installed');
    }

    // Root dependencies
    try {
      await fs.access('package.json');
      log.info('Installing root dependencies...');
      await execAsync('npm install');
      log.success('Root dependencies installed');
    } catch {
      log.info('No root package.json found, skipping root dependencies');
    }
  }

  async directoryExists(path) {
    try {
      const stats = await fs.stat(path);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
}

// Database management
class DatabaseManager {
  async setupDatabase() {
    log.step('Setting up database...');

    try {
      // Check if database exists
      const { stdout } = await execAsync('psql -lqt | cut -d \\| -f 1 | grep -qw memecoin_trading');
      log.info('Database already exists');
    } catch {
      log.info('Creating database...');
      try {
        await execAsync('createdb memecoin_trading');
        log.success('Database created');
      } catch (error) {
        log.warning(`Database creation failed: ${error.message}`);
      }
    }

    // Run Prisma operations
    if (await new EnvironmentManager().directoryExists(CONFIG.paths.backend)) {
      try {
        log.info('Generating Prisma client...');
        await execAsync('npm run db:generate', { cwd: CONFIG.paths.backend });

        log.info('Pushing database schema...');
        await execAsync('npm run db:push', { cwd: CONFIG.paths.backend });

        log.info('Seeding database...');
        await execAsync('npm run db:seed', { cwd: CONFIG.paths.backend });

        log.success('Database setup completed');
      } catch (error) {
        log.error(`Database setup failed: ${error.message}`);
        throw error;
      }
    }
  }

  async testDatabaseConnection() {
    log.info('Testing database connection...');

    const healthChecker = new HealthChecker();
    const isConnected = await healthChecker.checkDatabase();

    if (isConnected) {
      log.success('Database connection successful');
      return true;
    } else {
      log.error('Database connection failed');
      return false;
    }
  }
}

// Integration tests
class IntegrationTester {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
  }

  async runTests() {
    log.step('Running integration tests...');

    try {
      // Unit tests
      log.info('Running unit tests...');
      await execAsync('npm test -- --testPathPattern=unit --coverage', {
        cwd: CONFIG.paths.backend,
        timeout: CONFIG.timeouts.integration_test
      });
      log.success('Unit tests passed');

      // Integration tests
      log.info('Running integration tests...');
      await execAsync('npm test -- --testPathPattern=integration', {
        cwd: CONFIG.paths.backend,
        timeout: CONFIG.timeouts.integration_test
      });
      log.success('Integration tests passed');

      // API health check
      await this.testApiEndpoints();

      // WebSocket tests
      await this.testWebSocketConnection();

      log.success('All integration tests passed');
      return true;
    } catch (error) {
      log.error(`Integration tests failed: ${error.message}`);
      return false;
    }
  }

  async testApiEndpoints() {
    log.info('Testing API endpoints...');

    const healthChecker = new HealthChecker();
    const endpoints = [
      'http://localhost:3000/health',
      'http://localhost:3000/api/tokens/discover'
    ];

    for (const endpoint of endpoints) {
      const isHealthy = await healthChecker.checkHttp(endpoint);
      if (!isHealthy) {
        throw new Error(`API endpoint ${endpoint} is not responding`);
      }
    }

    log.success('API endpoints are responding');
  }

  async testWebSocketConnection() {
    log.info('Testing WebSocket connection...');

    return new Promise((resolve, reject) => {
      const WebSocket = require('ws');
      const ws = new WebSocket('ws://localhost:3002/ws');

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      ws.on('open', () => {
        clearTimeout(timeout);
        ws.close();
        log.success('WebSocket connection successful');
        resolve();
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket connection failed: ${error.message}`));
      });
    });
  }
}

// Main integration orchestrator
class IntegrationOrchestrator {
  constructor() {
    this.serviceManager = new ServiceManager();
    this.healthChecker = new HealthChecker();
    this.envManager = new EnvironmentManager();
    this.dbManager = new DatabaseManager();
    this.tester = new IntegrationTester(this.serviceManager);
  }

  async run() {
    log.info('🚀 Starting Memecoin Trading Algorithm Integration...');

    try {
      // Setup phase
      await this.envManager.setupEnvironment();
      await this.envManager.installDependencies();

      // Infrastructure phase
      await this.startInfrastructure();
      await this.dbManager.setupDatabase();

      // Services phase
      await this.startServices();

      // Testing phase
      await this.tester.runTests();

      log.success('🎉 Integration completed successfully!');

      // Display service status
      this.displayServiceStatus();

      // Keep services running
      log.info('Services are running. Press Ctrl+C to stop all services.');
      await this.waitForShutdown();

    } catch (error) {
      log.error(`Integration failed: ${error.message}`);
      process.exit(1);
    }
  }

  async startInfrastructure() {
    log.step('Starting infrastructure services...');

    // Check Redis
    if (!await this.healthChecker.checkRedis()) {
      log.info('Starting Redis...');
      try {
        await execAsync('redis-server --daemonize yes');
        await this.healthChecker.waitForService('Redis', () => this.healthChecker.checkRedis());
      } catch (error) {
        log.warning(`Failed to start Redis: ${error.message}`);
      }
    } else {
      log.success('Redis is already running');
    }

    // Check PostgreSQL
    if (!await this.healthChecker.checkDatabase()) {
      log.warning('PostgreSQL is not running. Please start it manually:');
      log.info('sudo systemctl start postgresql');
      log.info('Or: brew services start postgresql (macOS)');
      process.exit(1);
    } else {
      log.success('PostgreSQL is running');
    }
  }

  async startServices() {
    log.step('Starting application services...');

    // Start backend API
    if (await this.envManager.directoryExists(CONFIG.paths.backend)) {
      await this.serviceManager.startService('Backend', 'dev', CONFIG.paths.backend);
      await this.healthChecker.waitForService(
        'Backend API',
        () => this.healthChecker.checkHttp('http://localhost:3000/health')
      );
    }

    // Start WebSocket server (if separate)
    // Note: This might be part of the backend service

    // Start frontend (if exists)
    if (await this.envManager.directoryExists(CONFIG.paths.frontend)) {
      await this.serviceManager.startService('Frontend', 'start', CONFIG.paths.frontend, {
        PORT: '3001'
      });
      await this.healthChecker.waitForService(
        'Frontend',
        () => this.healthChecker.checkHttp('http://localhost:3001')
      );
    }
  }

  displayServiceStatus() {
    console.log('\n📊 Service Status:');
    console.log('━'.repeat(50));

    const services = [
      { name: 'PostgreSQL', check: () => this.healthChecker.checkDatabase() },
      { name: 'Redis', check: () => this.healthChecker.checkRedis() },
      { name: 'Backend API', check: () => this.healthChecker.checkHttp('http://localhost:3000/health') },
      { name: 'WebSocket', check: () => this.healthChecker.checkPort(3002) },
      { name: 'Frontend', check: () => this.healthChecker.checkHttp('http://localhost:3001') }
    ];

    services.forEach(async (service) => {
      const status = await service.check() ? '✅ RUNNING' : '❌ STOPPED';
      console.log(`${service.name}: ${status}`);
    });

    console.log('━'.repeat(50));
    console.log('\n🌐 Service URLs:');
    console.log('• Backend API: http://localhost:3000');
    console.log('• WebSocket: ws://localhost:3002/ws');
    console.log('• Frontend: http://localhost:3001');
    console.log('• API Docs: http://localhost:3000/docs');
    console.log('\n📄 Log files are in ./logs/');
  }

  async waitForShutdown() {
    return new Promise((resolve) => {
      process.on('SIGINT', async () => {
        log.info('\n🛑 Shutting down services...');
        await this.serviceManager.stopAll();
        log.success('All services stopped');
        resolve();
      });
    });
  }
}

// Main execution
async function main() {
  const orchestrator = new IntegrationOrchestrator();

  // Handle uncaught errors
  process.on('uncaughtException', async (error) => {
    log.error(`Uncaught exception: ${error.message}`);
    await orchestrator.serviceManager.stopAll();
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason) => {
    log.error(`Unhandled rejection: ${reason}`);
    await orchestrator.serviceManager.stopAll();
    process.exit(1);
  });

  await orchestrator.run();
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { IntegrationOrchestrator, ServiceManager, HealthChecker };