/**
 * Global test setup and configuration
 * Runs before all tests to initialize testing environment
 */

const { logger } = require('../src/utils/logger');

// Global test timeout
jest.setTimeout(30000);

// Setup global mocks
global.console = {
  ...console,
  // Suppress console.log in tests unless specifically testing logging
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Setup environment variables for testing
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.REDIS_URL = 'redis://localhost:6379/15'; // Use test database
process.env.API_PORT = '0'; // Use random available port

// Global test utilities
global.testUtils = {
  generateMockToken: () => ({
    address: '0x' + Math.random().toString(16).substring(2, 42),
    symbol: 'TEST' + Math.floor(Math.random() * 1000),
    name: 'Test Token',
    decimals: 18,
    totalSupply: '1000000000000000000000000',
    createdAt: new Date().toISOString(),
    network: 'ethereum'
  }),

  generateMockTransaction: () => ({
    hash: '0x' + Math.random().toString(16).substring(2, 66),
    from: '0x' + Math.random().toString(16).substring(2, 42),
    to: '0x' + Math.random().toString(16).substring(2, 42),
    value: Math.floor(Math.random() * 1000000),
    timestamp: Math.floor(Date.now() / 1000),
    blockNumber: Math.floor(Math.random() * 1000000)
  }),

  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  createMockServer: (port = 0) => {
    const express = require('express');
    const app = express();
    app.use(express.json());
    return app;
  }
};

// Clean up after each test
afterEach(async () => {
  // Clear all mocks
  jest.clearAllMocks();

  // Reset any global state
  if (global.testRedisClient) {
    await global.testRedisClient.flushdb();
  }
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});