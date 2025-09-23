import '@testing-library/jest-dom';

// Type definitions for test objects
interface ApiResponse {
  statusCode?: number;
  body?: unknown;
}

interface TokenData {
  symbol?: string;
  name?: string;
  address?: string;
}

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toHaveValidResponse(): R;
      toBeValidToken(): R;
    }
  }
}

// Custom Jest matchers for backend testing
expect.extend({
  toBeValidUUID(received: unknown) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = typeof received === 'string' && uuidRegex.test(received);
    return {
      message: () => `expected ${received} to ${pass ? 'not ' : ''}be a valid UUID`,
      pass,
    };
  },

  toHaveValidResponse(received: unknown) {
    const response = received as ApiResponse;
    const hasStatusCode = response.statusCode !== undefined;
    const hasBody = response.body !== undefined;
    const pass = hasStatusCode && hasBody;
    return {
      message: () => `expected response to ${pass ? 'not ' : ''}have valid structure`,
      pass,
    };
  },

  toBeValidToken(received: unknown) {
    const token = received as TokenData;
    const hasRequiredFields = token?.symbol && token?.name && token?.address;
    const pass = hasRequiredFields;
    return {
      message: () => `expected ${JSON.stringify(received)} to ${pass ? 'not ' : ''}be a valid token`,
      pass,
    };
  }
});

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/memecoin_test';
  process.env.REDIS_URL = 'redis://localhost:6379/1';
  process.env.JWT_SECRET = 'test-secret';
});

afterAll(async () => {
  // Cleanup after all tests
});

// Global error handling for unhandled promises
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

// Mock external services by default
jest.mock('axios');
jest.mock('ioredis');
jest.mock('socket.io');
jest.mock('ws');

// Console override for cleaner test output
const originalError = console.error;
beforeEach(() => {
  console.error = jest.fn();
});

afterEach(() => {
  console.error = originalError;
});