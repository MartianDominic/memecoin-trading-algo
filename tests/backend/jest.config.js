module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  displayName: 'Backend Tests',
  roots: ['<rootDir>/../../backend/src', '<rootDir>/../../src', '<rootDir>'],
  testMatch: [
    '<rootDir>/**/*.test.ts',
    '<rootDir>/**/*.spec.ts',
    '<rootDir>/../../backend/src/**/*.test.ts',
    '<rootDir>/../../src/**/*.test.ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/../../src/$1',
    '^@backend/(.*)$': '<rootDir>/../../backend/src/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/setup/backend.setup.ts'],
  collectCoverageFrom: [
    '<rootDir>/../../backend/src/**/*.ts',
    '<rootDir>/../../src/**/*.ts',
    '!**/*.d.ts',
    '!**/*.test.ts',
    '!**/*.spec.ts',
    '!**/node_modules/**'
  ],
  coverageDirectory: '<rootDir>/../../coverage/backend',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
  verbose: true,
  detectOpenHandles: true,
  forceExit: true
};