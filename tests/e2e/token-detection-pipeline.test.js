const { test, expect, chromium, firefox, webkit } = require('@playwright/test');

// Cross-browser testing configuration
const browsers = [chromium, firefox, webkit];

describe('Token Detection Pipeline E2E Tests', () => {
  let browser;
  let context;
  let page;

  const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

  beforeAll(async () => {
    // Use chromium for main tests, other browsers for compatibility
    browser = await chromium.launch({
      headless: process.env.CI === 'true',
      slowMo: process.env.CI === 'true' ? 0 : 100
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      // Mock geolocation for consistent testing
      geolocation: { latitude: 37.7749, longitude: -122.4194 },
      permissions: ['geolocation']
    });

    page = await context.newPage();

    // Mock WebSocket connections for real-time features
    await page.route('ws://localhost:*', route => {
      route.fulfill({ status: 200 });
    });

    // Mock API responses for consistent testing
    await page.route('**/api/tokens', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              address: 'test-token-1',
              symbol: 'TEST1',
              name: 'Test Token 1',
              price: 0.001,
              volume24h: 100000,
              marketCap: 500000,
              priceChange24h: 25.5,
              verified: true,
              tags: ['meme'],
              createdAt: new Date().toISOString()
            },
            {
              address: 'test-token-2',
              symbol: 'TEST2',
              name: 'Test Token 2',
              price: 0.005,
              volume24h: 50000,
              marketCap: 250000,
              priceChange24h: -10.2,
              verified: false,
              tags: ['defi'],
              createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            }
          ],
          metadata: {
            totalTokens: 2,
            lastUpdated: new Date().toISOString()
          }
        })
      });
    });

    await page.goto(BASE_URL);
  });

  afterEach(async () => {
    await context.close();
  });

  test('should load dashboard and display token list', async () => {
    // Wait for page to load
    await expect(page.locator('h1')).toContainText('Memecoin Trading Dashboard');

    // Check token list is displayed
    await expect(page.locator('[data-testid="token-list"]')).toBeVisible();

    // Verify token data is loaded
    await expect(page.locator('[data-testid="token-item"]')).toHaveCount(2);

    // Check specific token information
    const firstToken = page.locator('[data-testid="token-item"]').first();
    await expect(firstToken.locator('[data-testid="token-symbol"]')).toContainText('TEST1');
    await expect(firstToken.locator('[data-testid="token-price"]')).toContainText('$0.001');
    await expect(firstToken.locator('[data-testid="token-change"]')).toContainText('25.5%');
  });

  test('should open and use filter builder', async () => {
    // Open filter builder
    await page.click('[data-testid="open-filter-builder"]');
    await expect(page.locator('[data-testid="filter-builder"]')).toBeVisible();

    // Add a filter condition
    await page.click('[data-testid="add-filter-condition"]');

    // Configure filter: volume24h >= 75000
    await page.selectOption('[data-testid="filter-field-select"]', 'volume24h');
    await page.selectOption('[data-testid="filter-operator-select"]', 'gte');
    await page.fill('[data-testid="filter-value-input"]', '75000');

    // Apply filters
    await page.click('[data-testid="apply-filters"]');

    // Wait for filtered results
    await page.waitForSelector('[data-testid="filter-results"]');

    // Should only show tokens with volume >= 75000
    await expect(page.locator('[data-testid="token-item"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="token-symbol"]').first()).toContainText('TEST1');
  });

  test('should create and apply complex multi-condition filters', async () => {
    await page.click('[data-testid="open-filter-builder"]');

    // Add first condition: volume24h >= 50000
    await page.click('[data-testid="add-filter-condition"]');
    await page.selectOption('[data-testid="filter-field-select"]', 'volume24h');
    await page.selectOption('[data-testid="filter-operator-select"]', 'gte');
    await page.fill('[data-testid="filter-value-input"]', '50000');

    // Add second condition: priceChange24h >= 0
    await page.click('[data-testid="add-filter-condition"]');
    const secondCondition = page.locator('[data-testid="filter-condition"]').nth(1);
    await secondCondition.locator('[data-testid="filter-field-select"]').selectOption('priceChange24h');
    await secondCondition.locator('[data-testid="filter-operator-select"]').selectOption('gte');
    await secondCondition.locator('[data-testid="filter-value-input"]').fill('0');

    // Set logic to AND
    await page.selectOption('[data-testid="filter-logic-select"]', 'AND');

    // Apply filters
    await page.click('[data-testid="apply-filters"]');

    // Should show only TEST1 (positive change and high volume)
    await expect(page.locator('[data-testid="token-item"]')).toHaveCount(1);
  });

  test('should save and load filter presets', async () => {
    await page.click('[data-testid="open-filter-builder"]');

    // Create a filter
    await page.click('[data-testid="add-filter-condition"]');
    await page.selectOption('[data-testid="filter-field-select"]', 'verified');
    await page.selectOption('[data-testid="filter-operator-select"]', 'eq');
    await page.selectOption('[data-testid="filter-value-select"]', 'true');

    // Save as preset
    await page.click('[data-testid="save-preset"]');
    await page.fill('[data-testid="preset-name-input"]', 'Verified Tokens Only');
    await page.click('[data-testid="confirm-save-preset"]');

    // Clear filters
    await page.click('[data-testid="clear-filters"]');
    await expect(page.locator('[data-testid="filter-condition"]')).toHaveCount(0);

    // Load preset
    await page.selectOption('[data-testid="preset-select"]', 'Verified Tokens Only');

    // Verify filter was restored
    await expect(page.locator('[data-testid="filter-condition"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="filter-field-select"]')).toHaveValue('verified');
  });

  test('should display token details modal', async () => {
    // Click on first token
    await page.click('[data-testid="token-item"]');

    // Modal should open
    await expect(page.locator('[data-testid="token-details-modal"]')).toBeVisible();

    // Check modal content
    await expect(page.locator('[data-testid="modal-token-symbol"]')).toContainText('TEST1');
    await expect(page.locator('[data-testid="modal-token-address"]')).toContainText('test-token-1');
    await expect(page.locator('[data-testid="modal-market-cap"]')).toContainText('$500,000');

    // Check tabs
    await expect(page.locator('[data-testid="price-history-tab"]')).toBeVisible();
    await expect(page.locator('[data-testid="holders-tab"]')).toBeVisible();
    await expect(page.locator('[data-testid="transactions-tab"]')).toBeVisible();

    // Switch to price history tab
    await page.click('[data-testid="price-history-tab"]');
    await expect(page.locator('[data-testid="price-chart"]')).toBeVisible();

    // Close modal
    await page.click('[data-testid="close-modal"]');
    await expect(page.locator('[data-testid="token-details-modal"]')).not.toBeVisible();
  });

  test('should sort tokens by different criteria', async () => {
    // Test sorting by volume (descending)
    await page.selectOption('[data-testid="sort-select"]', 'volume24h');
    await page.selectOption('[data-testid="sort-order-select"]', 'desc');

    // First token should be TEST1 (higher volume)
    const firstToken = page.locator('[data-testid="token-item"]').first();
    await expect(firstToken.locator('[data-testid="token-symbol"]')).toContainText('TEST1');

    // Test sorting by price change (ascending)
    await page.selectOption('[data-testid="sort-select"]', 'priceChange24h');
    await page.selectOption('[data-testid="sort-order-select"]', 'asc');

    // First token should be TEST2 (negative change)
    await expect(firstToken.locator('[data-testid="token-symbol"]')).toContainText('TEST2');
  });

  test('should handle pagination correctly', async () => {
    // Mock API with more tokens for pagination testing
    await page.route('**/api/tokens*', route => {
      const url = new URL(route.request().url());
      const page_num = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '10');

      const totalTokens = 25;
      const startIndex = (page_num - 1) * limit;
      const endIndex = Math.min(startIndex + limit, totalTokens);

      const tokens = [];
      for (let i = startIndex; i < endIndex; i++) {
        tokens.push({
          address: `token-${i}`,
          symbol: `TOK${i}`,
          name: `Token ${i}`,
          price: 0.001 * (i + 1),
          volume24h: 10000 * (i + 1),
          marketCap: 50000 * (i + 1)
        });
      }

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: tokens,
          metadata: {
            totalTokens,
            pagination: {
              page: page_num,
              limit,
              total: totalTokens,
              pages: Math.ceil(totalTokens / limit)
            }
          }
        })
      });
    });

    await page.reload();

    // Check pagination controls
    await expect(page.locator('[data-testid="pagination"]')).toBeVisible();
    await expect(page.locator('[data-testid="page-info"]')).toContainText('Page 1 of 3');

    // Go to next page
    await page.click('[data-testid="next-page"]');
    await expect(page.locator('[data-testid="page-info"]')).toContainText('Page 2 of 3');

    // Go to specific page
    await page.click('[data-testid="page-3"]');
    await expect(page.locator('[data-testid="page-info"]')).toContainText('Page 3 of 3');

    // Previous page button should work
    await page.click('[data-testid="prev-page"]');
    await expect(page.locator('[data-testid="page-info"]')).toContainText('Page 2 of 3');
  });

  test('should export filtered results', async () => {
    // Setup download monitoring
    const downloadPromise = page.waitForEvent('download');

    // Apply a filter first
    await page.click('[data-testid="open-filter-builder"]');
    await page.click('[data-testid="add-filter-condition"]');
    await page.selectOption('[data-testid="filter-field-select"]', 'verified');
    await page.selectOption('[data-testid="filter-operator-select"]', 'eq');
    await page.selectOption('[data-testid="filter-value-select"]', 'true');
    await page.click('[data-testid="apply-filters"]');

    // Export results
    await page.click('[data-testid="export-results"]');
    await page.selectOption('[data-testid="export-format"]', 'csv');
    await page.click('[data-testid="confirm-export"]');

    // Verify download started
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/filtered-tokens.*\.csv$/);
  });

  test('should handle real-time updates (WebSocket simulation)', async () => {
    // Simulate WebSocket message with price update
    await page.evaluate(() => {
      // Simulate receiving a WebSocket message
      window.dispatchEvent(new CustomEvent('tokenUpdate', {
        detail: {
          address: 'test-token-1',
          price: 0.0015,
          priceChange24h: 50.0
        }
      }));
    });

    // Check that the UI updated
    const firstToken = page.locator('[data-testid="token-item"]').first();
    await expect(firstToken.locator('[data-testid="token-price"]')).toContainText('$0.0015');
    await expect(firstToken.locator('[data-testid="token-change"]')).toContainText('50.0%');

    // Should show update indicator
    await expect(firstToken.locator('[data-testid="update-indicator"]')).toBeVisible();
  });

  test('should handle error states gracefully', async () => {
    // Mock API error
    await page.route('**/api/tokens', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Internal server error'
        })
      });
    });

    await page.reload();

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Failed to load token data');

    // Retry button should be available
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();

    // Mock successful response for retry
    await page.route('**/api/tokens', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
          metadata: { totalTokens: 0 }
        })
      });
    });

    await page.click('[data-testid="retry-button"]');
    await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
  });

  test('should be responsive on different screen sizes', async () => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });

    // Mobile menu should be available
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();

    // Filter builder should adapt to mobile
    await page.click('[data-testid="mobile-menu-button"]');
    await page.click('[data-testid="mobile-filter-button"]');
    await expect(page.locator('[data-testid="mobile-filter-builder"]')).toBeVisible();

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });

    // Should show tablet layout
    await expect(page.locator('[data-testid="tablet-layout"]')).toBeVisible();

    // Test desktop view
    await page.setViewportSize({ width: 1280, height: 720 });

    // Should show full desktop layout
    await expect(page.locator('[data-testid="desktop-layout"]')).toBeVisible();
  });

  test('should maintain performance under load', async () => {
    // Mock large dataset
    await page.route('**/api/tokens', route => {
      const tokens = Array(1000).fill(null).map((_, i) => ({
        address: `token-${i}`,
        symbol: `TOK${i}`,
        name: `Token ${i}`,
        price: Math.random(),
        volume24h: Math.random() * 1000000,
        marketCap: Math.random() * 10000000
      }));

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: tokens,
          metadata: { totalTokens: 1000 }
        })
      });
    });

    const startTime = Date.now();
    await page.reload();

    // Wait for content to load
    await page.waitForSelector('[data-testid="token-list"]');

    const loadTime = Date.now() - startTime;

    // Should load within reasonable time even with large dataset
    expect(loadTime).toBeLessThan(5000);

    // Scrolling should be smooth
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    // UI should remain responsive
    await page.click('[data-testid="open-filter-builder"]');
    await expect(page.locator('[data-testid="filter-builder"]')).toBeVisible();
  });
});

// Cross-browser compatibility tests
browsers.forEach((browserType, index) => {
  if (index === 0) return; // Skip chromium as it's already tested above

  test.describe(`Cross-browser compatibility - ${browserType.name()}`, () => {
    let browser;

    beforeAll(async () => {
      browser = await browserType.launch({ headless: true });
    });

    afterAll(async () => {
      await browser.close();
    });

    test(`should work correctly in ${browserType.name()}`, async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(BASE_URL);

      // Basic functionality test
      await expect(page.locator('h1')).toContainText('Memecoin Trading Dashboard');
      await expect(page.locator('[data-testid="token-list"]')).toBeVisible();

      await context.close();
    });
  });
});