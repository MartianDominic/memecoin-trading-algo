# Testing Guide - Memecoin Trading Algorithm

## 📋 Overview

This guide provides comprehensive documentation for the testing infrastructure of the memecoin trading algorithm. The testing strategy follows industry best practices with multiple layers of validation to ensure code quality, performance, and reliability.

## 🏗️ Testing Architecture

### Test Pyramid Structure

```
         /\
        /E2E\      <- End-to-End (Few, High-Value)
       /------\
      /Integr.\   <- Integration (Medium Coverage)
     /----------\
    /   Unit     \ <- Unit Tests (Many, Fast, Focused)
   /--------------\
```

### Test Categories

1. **Unit Tests** - Test individual functions and components in isolation
2. **Integration Tests** - Test API endpoints and database operations
3. **Component Tests** - Test React components with user interactions
4. **End-to-End Tests** - Test complete user workflows
5. **Performance Tests** - Test system performance under load
6. **Security Tests** - Test for vulnerabilities and security issues

## 🚀 Quick Start

### Prerequisites

```bash
# Install dependencies
npm install

# Install Playwright for E2E tests
npx playwright install --with-deps
```

### Running Tests

```bash
# Run all tests
npm run test

# Run specific test categories
npm run test:backend:unit        # Backend unit tests
npm run test:backend:integration # Backend integration tests
npm run test:frontend:unit       # Frontend unit tests
npm run test:frontend:components # Component tests
npm run test:e2e                 # End-to-end tests
npm run test:performance         # Performance tests

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 📁 Test Directory Structure

```
tests/
├── setup/                  # Test configuration and setup
│   ├── jest.setup.js      # Global Jest configuration
│   └── frontend.setup.js  # Frontend-specific setup
├── mocks/                 # Mock data and API responses
│   ├── solana-token-data.js
│   └── api-responses.js
├── utils/                 # Test utilities and helpers
├── fixtures/              # Test data fixtures
├── unit/                  # Unit tests (shared)
├── integration/           # Integration tests
├── e2e/                   # End-to-end tests
└── performance/           # Performance and load tests

backend/tests/
├── unit/                  # Backend unit tests
└── integration/           # Backend integration tests

frontend/src/__tests__/
├── components/            # Component tests
├── hooks/                 # Hook tests
└── utils/                 # Utility function tests
```

## 🧪 Writing Tests

### Unit Tests

Unit tests should focus on testing individual functions and methods in isolation.

```javascript
// Example: Testing a utility function
describe('calculatePriceChange', () => {
  it('should calculate positive price change correctly', () => {
    const oldPrice = 100;
    const newPrice = 150;
    const result = calculatePriceChange(oldPrice, newPrice);

    expect(result).toBe(50); // 50% increase
  });

  it('should handle zero price gracefully', () => {
    expect(() => calculatePriceChange(0, 100)).not.toThrow();
  });
});
```

### Integration Tests

Integration tests verify that different parts of the system work together correctly.

```javascript
// Example: Testing API endpoints
describe('GET /api/tokens', () => {
  it('should return paginated token data', async () => {
    const response = await request(app)
      .get('/api/tokens')
      .query({ page: 1, limit: 10 })
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveLength(10);
    expect(response.body).toHaveProperty('metadata.pagination');
  });
});
```

### Component Tests

Component tests verify React component behavior and user interactions.

```javascript
// Example: Testing a React component
describe('TokenList Component', () => {
  it('should display tokens when data is loaded', () => {
    const mockTokens = [
      { symbol: 'TEST1', price: 0.001, volume24h: 100000 }
    ];

    render(<TokenList tokens={mockTokens} />);

    expect(screen.getByText('TEST1')).toBeInTheDocument();
    expect(screen.getByText('$0.001')).toBeInTheDocument();
  });
});
```

### End-to-End Tests

E2E tests verify complete user workflows using Playwright.

```javascript
// Example: Testing user workflow
test('should filter tokens and view details', async ({ page }) => {
  await page.goto('/');

  // Open filter builder
  await page.click('[data-testid="open-filter-builder"]');

  // Add filter condition
  await page.click('[data-testid="add-filter-condition"]');
  await page.selectOption('[data-testid="filter-field"]', 'volume24h');
  await page.fill('[data-testid="filter-value"]', '50000');

  // Apply filters
  await page.click('[data-testid="apply-filters"]');

  // Verify filtered results
  await expect(page.locator('[data-testid="token-item"]')).toHaveCount(5);
});
```

## 🔧 Test Configuration

### Jest Configuration

The main Jest configuration is in `tests/jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Multiple project configurations
  projects: [
    {
      displayName: 'Backend Unit Tests',
      testMatch: ['<rootDir>/backend/tests/unit/**/*.(test|spec).(ts|js)']
    },
    {
      displayName: 'Frontend Unit Tests',
      testMatch: ['<rootDir>/frontend/src/**/*.(test|spec).(ts|tsx|js|jsx)'],
      testEnvironment: 'jsdom'
    }
  ]
};
```

### Playwright Configuration

E2E test configuration in `playwright.config.js`:

```javascript
module.exports = {
  testDir: './tests/e2e',
  timeout: 30000,

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ],

  webServer: {
    command: 'npm run start:test',
    port: 3000,
    reuseExistingServer: !process.env.CI
  }
};
```

## 🎭 Mock Data and APIs

### Using Mock Data

The testing infrastructure includes comprehensive mock data generators:

```javascript
const { SolanaTokenDataMock } = require('./tests/mocks/solana-token-data');

// Generate mock tokens
const tokenMock = new SolanaTokenDataMock();
const tokens = tokenMock.generateTokens(100);

// Generate mock API responses
const apiResponses = tokenMock.generateAPIResponses();
```

### Mocking External APIs

API responses are mocked to ensure consistent test behavior:

```javascript
const { APIResponseMocks } = require('./tests/mocks/api-responses');

beforeEach(() => {
  const apiMocks = new APIResponseMocks();
  const { mockFetch } = apiMocks.setupFetchMocks();
  global.fetch = mockFetch;
});
```

## 📊 Performance Testing

### Load Testing

Performance tests use autocannon for load testing:

```javascript
const { PerformanceTester } = require('./tests/performance/load-testing');

const tester = new PerformanceTester({
  baseUrl: 'http://localhost:3000',
  duration: 30, // seconds
  connections: 10
});

await tester.runLoadTests();
```

### Performance Thresholds

- **Response Time**: API responses should be under 1000ms (p95)
- **Throughput**: Minimum 100 requests/second
- **Memory Usage**: Memory increase should be less than 500MB during stress tests
- **CPU Usage**: Should handle concurrent operations efficiently

## 🛡️ Security Testing

### Automated Security Scans

Security tests are integrated into the CI/CD pipeline:

```bash
# Run security audit
npm audit --audit-level=moderate

# Run Snyk security scan
snyk test --severity-threshold=medium
```

### Security Test Categories

1. **Input Validation** - Test for SQL injection, XSS, etc.
2. **Authentication** - Test authentication flows and JWT handling
3. **Authorization** - Test access control and permissions
4. **Rate Limiting** - Test API rate limiting effectiveness

## 📈 Coverage Requirements

### Minimum Coverage Thresholds

- **Statements**: 80%
- **Branches**: 75%
- **Functions**: 80%
- **Lines**: 80%

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View coverage report
open coverage/lcov-report/index.html
```

## 🔄 CI/CD Integration

### GitHub Actions Workflow

The CI/CD pipeline runs comprehensive tests:

1. **Unit Tests** - Run for backend and frontend
2. **Integration Tests** - Test API endpoints and database operations
3. **E2E Tests** - Test complete user workflows
4. **Performance Tests** - Validate performance thresholds
5. **Security Tests** - Run security audits and scans

### Test Environments

- **Development** - Local testing with hot reloading
- **Staging** - Pre-production testing environment
- **Production** - Production monitoring and smoke tests

## 🚨 Test Data Management

### Test Database

```bash
# Setup test database
npm run db:setup:test

# Run migrations for test environment
npm run db:migrate:test

# Seed test data
npm run db:seed:test

# Reset test database
npm run db:reset:test
```

### Environment Variables

```bash
# Test environment configuration
NODE_ENV=test
DATABASE_URL=postgresql://test_user:test_password@localhost:5432/test_db
JWT_SECRET=test-jwt-secret
API_RATE_LIMIT=1000
```

## 🎯 Testing Best Practices

### General Guidelines

1. **Test First** - Write tests before implementation (TDD)
2. **One Assertion** - Each test should verify one specific behavior
3. **Descriptive Names** - Test names should explain what and why
4. **Independent Tests** - Tests should not depend on each other
5. **Mock External Dependencies** - Keep tests isolated and fast

### Naming Conventions

```javascript
// Good: Describes what is being tested and expected behavior
describe('TokenAggregator', () => {
  describe('fetchFromAllSources', () => {
    it('should aggregate data from all API sources', () => {
      // Test implementation
    });

    it('should handle individual service failures gracefully', () => {
      // Test implementation
    });
  });
});
```

### Test Data Patterns

```javascript
// Use factories for consistent test data
const createMockToken = (overrides = {}) => ({
  address: 'default-address',
  symbol: 'DEFAULT',
  price: 0.001,
  volume24h: 10000,
  ...overrides
});

// Use builders for complex test scenarios
const TokenBuilder = {
  withHighVolume: () => createMockToken({ volume24h: 1000000 }),
  withLowPrice: () => createMockToken({ price: 0.0001 }),
  verified: () => createMockToken({ verified: true })
};
```

## 🐛 Debugging Tests

### Common Issues

1. **Flaky Tests** - Tests that pass/fail intermittently
   - Solution: Use proper wait conditions, avoid hard-coded delays

2. **Slow Tests** - Tests taking too long to run
   - Solution: Mock external dependencies, optimize database operations

3. **Memory Leaks** - Tests consuming excessive memory
   - Solution: Properly clean up resources in afterEach hooks

### Debugging Tools

```bash
# Run tests with debugging
npm run test:debug

# Run specific test file
npm test -- --testNamePattern="specific test name"

# Run tests with verbose output
npm test -- --verbose

# Run tests in watch mode for development
npm run test:watch
```

## 📚 Additional Resources

### Testing Tools Documentation

- [Jest](https://jestjs.io/docs/) - JavaScript testing framework
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) - React component testing
- [Playwright](https://playwright.dev/) - End-to-end testing
- [Supertest](https://github.com/visionmedia/supertest) - HTTP assertion library

### Reference Materials

- [Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [React Testing Patterns](https://react-testing-examples.com/)

---

For questions or suggestions about testing, please check the existing issues or create a new one in the project repository.