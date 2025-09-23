module.exports = {
  // Global test configuration
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Test paths
  roots: ['<rootDir>/backend', '<rootDir>/frontend', '<rootDir>/tests'],

  // Module paths
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/backend/src/$1',
    '^@frontend/(.*)$': '<rootDir>/frontend/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },

  // Test patterns
  testMatch: [
    '**/__tests__/**/*.(test|spec).(ts|tsx|js|jsx)',
    '**/tests/**/*.(test|spec).(ts|tsx|js|jsx)'
  ],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  collectCoverageFrom: [
    'backend/src/**/*.{ts,js}',
    'frontend/src/**/*.{ts,tsx,js,jsx}',
    '!backend/src/**/*.d.ts',
    '!frontend/src/**/*.d.ts',
    '!**/node_modules/**',
    '!**/coverage/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/jest.setup.js'
  ],

  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest'
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Test timeout
  testTimeout: 30000,

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Verbose output
  verbose: true,

  // Projects for different test types
  projects: [
    {
      displayName: 'Backend Unit Tests',
      testMatch: ['<rootDir>/backend/tests/unit/**/*.(test|spec).(ts|js)'],
      testEnvironment: 'node'
    },
    {
      displayName: 'Backend Integration Tests',
      testMatch: ['<rootDir>/backend/tests/integration/**/*.(test|spec).(ts|js)'],
      testEnvironment: 'node'
    },
    {
      displayName: 'Frontend Unit Tests',
      testMatch: ['<rootDir>/frontend/src/**/*.(test|spec).(ts|tsx|js|jsx)'],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/tests/setup/frontend.setup.js']
    },
    {
      displayName: 'E2E Tests',
      testMatch: ['<rootDir>/tests/e2e/**/*.(test|spec).(ts|js)'],
      testEnvironment: 'node'
    }
  ]
};