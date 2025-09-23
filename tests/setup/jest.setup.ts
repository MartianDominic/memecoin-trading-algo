import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { createTestDatabase, seedTestDatabase } from './database.setup';

// Load test environment variables
config({ path: '.env.test' });

// Global test variables
declare global {
  var __PRISMA__: PrismaClient;
  var __TEST_DB_URL__: string;
}

// Setup before all tests
beforeAll(async () => {
  // Initialize test database
  const testDbUrl = await createTestDatabase();
  global.__TEST_DB_URL__ = testDbUrl;

  // Initialize Prisma client for tests
  global.__PRISMA__ = new PrismaClient({
    datasources: {
      db: {
        url: testDbUrl
      }
    }
  });

  // Seed test data
  await seedTestDatabase(global.__PRISMA__);
});

// Cleanup after all tests
afterAll(async () => {
  if (global.__PRISMA__) {
    await global.__PRISMA__.$disconnect();
  }
});

// Setup before each test
beforeEach(() => {
  // Reset mocks
  jest.clearAllMocks();

  // Reset timers
  jest.useFakeTimers();
});

// Cleanup after each test
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// Enhanced matchers
expect.extend({
  toBeValidToken(received) {
    const pass = received &&
                 received.address &&
                 received.symbol &&
                 received.name;

    return {
      message: () =>
        pass
          ? `Expected ${received} not to be a valid token`
          : `Expected ${received} to be a valid token with address, symbol, and name`,
      pass,
    };
  },

  toHaveValidApiResponse(received) {
    const pass = received &&
                 received.status &&
                 received.data !== undefined;

    return {
      message: () =>
        pass
          ? `Expected ${received} not to be a valid API response`
          : `Expected ${received} to be a valid API response with status and data`,
      pass,
    };
  }
});

// Global error handling
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});