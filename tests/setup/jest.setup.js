// Global Jest setup
require('dotenv').config({ path: '.env.test' });

// Mock console methods for cleaner test output
global.console = {
  ...console,
  // Uncomment to suppress logs during tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn()
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'sqlite::memory:';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.API_RATE_LIMIT = '1000';

// Global test utilities
global.testUtils = {
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  mockDate: (date) => {
    const mockDate = new Date(date);
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
    return mockDate;
  },

  restoreDate: () => {
    global.Date.mockRestore?.();
  },

  generateRandomString: (length = 10) => {
    return Math.random().toString(36).substring(2, length + 2);
  }
};

// Setup and teardown hooks
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Restore date if mocked
  global.testUtils.restoreDate();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection in tests:', reason);
});

// Increase timeout for integration tests
jest.setTimeout(30000);