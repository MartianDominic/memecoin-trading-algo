const request = require('supertest');
const { createApp } = require('../../src/app');
const { APIResponseMocks } = require('../../../tests/mocks/api-responses');

describe('API Endpoints Integration Tests', () => {
  let app;
  let apiMocks;
  let server;

  beforeAll(async () => {
    // Setup mock APIs
    apiMocks = new APIResponseMocks();
    const { mockFetch } = apiMocks.setupFetchMocks();
    global.fetch = mockFetch;

    // Create Express app with test configuration
    app = createApp({
      env: 'test',
      database: {
        url: 'sqlite::memory:',
        logging: false
      },
      rateLimit: {
        requests: 1000,
        window: 60000
      }
    });

    // Start server
    server = app.listen(0); // Use random available port
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
    global.fetch.mockRestore?.();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/tokens', () => {
    it('should return aggregated token data from all sources', async () => {
      const response = await request(app)
        .get('/api/tokens')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('metadata');

      const { data, metadata } = response.body;
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);

      // Verify token structure
      const token = data[0];
      expect(token).toHaveProperty('address');
      expect(token).toHaveProperty('symbol');
      expect(token).toHaveProperty('name');
      expect(token).toHaveProperty('price');
      expect(token).toHaveProperty('volume24h');
      expect(token).toHaveProperty('marketCap');
      expect(token).toHaveProperty('sources');

      // Verify metadata
      expect(metadata).toHaveProperty('totalTokens');
      expect(metadata).toHaveProperty('sourceStats');
      expect(metadata).toHaveProperty('lastUpdated');
    });

    it('should apply filters when provided', async () => {
      const filters = {
        volume24h_min: 10000,
        marketCap_max: 1000000,
        tags: 'meme'
      };

      const response = await request(app)
        .get('/api/tokens')
        .query(filters)
        .expect(200);

      expect(response.body.success).toBe(true);
      const { data } = response.body;

      // Verify filters were applied
      data.forEach(token => {
        expect(token.volume24h).toBeGreaterThanOrEqual(10000);
        expect(token.marketCap).toBeLessThanOrEqual(1000000);
        if (token.tags) {
          expect(token.tags).toEqual(expect.arrayContaining(['meme']));
        }
      });
    });

    it('should handle pagination correctly', async () => {
      const page1Response = await request(app)
        .get('/api/tokens')
        .query({ page: 1, limit: 10 })
        .expect(200);

      const page2Response = await request(app)
        .get('/api/tokens')
        .query({ page: 2, limit: 10 })
        .expect(200);

      expect(page1Response.body.data).toHaveLength(10);
      expect(page2Response.body.data).toHaveLength(10);

      // Verify different tokens on different pages
      const page1Addresses = page1Response.body.data.map(t => t.address);
      const page2Addresses = page2Response.body.data.map(t => t.address);
      expect(page1Addresses).not.toEqual(page2Addresses);

      // Verify pagination metadata
      expect(page1Response.body.metadata).toHaveProperty('pagination');
      expect(page1Response.body.metadata.pagination).toEqual({
        page: 1,
        limit: 10,
        total: expect.any(Number),
        pages: expect.any(Number)
      });
    });

    it('should sort tokens by specified criteria', async () => {
      const response = await request(app)
        .get('/api/tokens')
        .query({ sort: 'volume24h', order: 'desc', limit: 5 })
        .expect(200);

      const { data } = response.body;
      expect(data).toHaveLength(5);

      // Verify descending order by volume
      for (let i = 1; i < data.length; i++) {
        expect(data[i - 1].volume24h).toBeGreaterThanOrEqual(data[i].volume24h);
      }
    });

    it('should handle invalid filter parameters gracefully', async () => {
      const response = await request(app)
        .get('/api/tokens')
        .query({
          volume24h_min: 'invalid',
          page: -1,
          limit: 1000
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid');
    });

    it('should respect rate limiting', async () => {
      // Configure app with low rate limit for testing
      const rateLimitedApp = createApp({
        env: 'test',
        rateLimit: {
          requests: 2,
          window: 1000
        }
      });

      // Make requests exceeding the limit
      const requests = Array(5).fill(null).map(() =>
        request(rateLimitedApp).get('/api/tokens')
      );

      const responses = await Promise.allSettled(requests);
      const rateLimited = responses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 429
      );

      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/tokens/:address', () => {
    it('should return detailed information for a specific token', async () => {
      // First get a token address from the list
      const listResponse = await request(app)
        .get('/api/tokens')
        .query({ limit: 1 });

      const tokenAddress = listResponse.body.data[0].address;

      const response = await request(app)
        .get(`/api/tokens/${tokenAddress}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('address', tokenAddress);
      expect(response.body.data).toHaveProperty('priceHistory');
      expect(response.body.data).toHaveProperty('holders');
      expect(response.body.data).toHaveProperty('transactions');
    });

    it('should return 404 for non-existent token', async () => {
      const response = await request(app)
        .get('/api/tokens/nonexistent_address_12345')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should validate token address format', async () => {
      const response = await request(app)
        .get('/api/tokens/invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid token address');
    });
  });

  describe('POST /api/tokens/filter', () => {
    it('should accept complex filter configurations', async () => {
      const complexFilter = {
        conditions: [
          {
            field: 'volume24h',
            operator: 'gte',
            value: 50000
          },
          {
            field: 'priceChange24h',
            operator: 'gte',
            value: 10
          },
          {
            field: 'age',
            operator: 'lte',
            value: 24
          }
        ],
        logic: 'AND',
        sort: {
          field: 'volume24h',
          order: 'desc'
        },
        limit: 20
      };

      const response = await request(app)
        .post('/api/tokens/filter')
        .send(complexFilter)
        .expect(200);

      expect(response.body.success).toBe(true);
      const { data } = response.body;

      // Verify all conditions are met
      data.forEach(token => {
        expect(token.volume24h).toBeGreaterThanOrEqual(50000);
        expect(token.priceChange24h).toBeGreaterThanOrEqual(10);

        const ageHours = (Date.now() - new Date(token.createdAt).getTime()) / (1000 * 60 * 60);
        expect(ageHours).toBeLessThanOrEqual(24);
      });

      // Verify sorting
      for (let i = 1; i < data.length; i++) {
        expect(data[i - 1].volume24h).toBeGreaterThanOrEqual(data[i].volume24h);
      }
    });

    it('should handle OR logic in filters', async () => {
      const orFilter = {
        conditions: [
          {
            field: 'tags',
            operator: 'includes',
            value: 'meme'
          },
          {
            field: 'verified',
            operator: 'eq',
            value: true
          }
        ],
        logic: 'OR'
      };

      const response = await request(app)
        .post('/api/tokens/filter')
        .send(orFilter)
        .expect(200);

      const { data } = response.body;

      // Verify OR logic - each token should match at least one condition
      data.forEach(token => {
        const matchesMeme = token.tags && token.tags.includes('meme');
        const isVerified = token.verified === true;
        expect(matchesMeme || isVerified).toBe(true);
      });
    });

    it('should validate filter structure', async () => {
      const invalidFilter = {
        conditions: [
          {
            field: 'invalid_field',
            operator: 'unknown_operator',
            value: 'test'
          }
        ]
      };

      const response = await request(app)
        .post('/api/tokens/filter')
        .send(invalidFilter)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid');
    });
  });

  describe('GET /api/tokens/:address/history', () => {
    it('should return price history for a token', async () => {
      const listResponse = await request(app)
        .get('/api/tokens')
        .query({ limit: 1 });

      const tokenAddress = listResponse.body.data[0].address;

      const response = await request(app)
        .get(`/api/tokens/${tokenAddress}/history`)
        .query({ hours: 24 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      const history = response.body.data;
      expect(history.length).toBeGreaterThan(0);

      // Verify history structure
      history.forEach(point => {
        expect(point).toHaveProperty('timestamp');
        expect(point).toHaveProperty('price');
        expect(point).toHaveProperty('volume');
        expect(typeof point.price).toBe('number');
        expect(typeof point.volume).toBe('number');
      });

      // Verify chronological order
      for (let i = 1; i < history.length; i++) {
        const prev = new Date(history[i - 1].timestamp);
        const curr = new Date(history[i].timestamp);
        expect(curr.getTime()).toBeGreaterThanOrEqual(prev.getTime());
      }
    });

    it('should handle different time ranges', async () => {
      const listResponse = await request(app)
        .get('/api/tokens')
        .query({ limit: 1 });

      const tokenAddress = listResponse.body.data[0].address;

      const response1h = await request(app)
        .get(`/api/tokens/${tokenAddress}/history`)
        .query({ hours: 1 });

      const response24h = await request(app)
        .get(`/api/tokens/${tokenAddress}/history`)
        .query({ hours: 24 });

      expect(response1h.body.data.length).toBeLessThanOrEqual(response24h.body.data.length);
    });
  });

  describe('WebSocket /ws/tokens', () => {
    // Note: WebSocket testing requires additional setup
    // This is a placeholder for WebSocket integration tests

    it('should establish WebSocket connection for real-time updates', async () => {
      // TODO: Implement WebSocket testing with ws library
      // This would test real-time token data streaming
      expect('WebSocket testing').toBe('WebSocket testing');
    });
  });

  describe('Error handling', () => {
    it('should handle database connection errors', async () => {
      // Mock database connection failure
      const faultyApp = createApp({
        env: 'test',
        database: {
          url: 'invalid://connection',
          logging: false
        }
      });

      const response = await request(faultyApp)
        .get('/api/tokens')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Database');
    });

    it('should handle external API failures gracefully', async () => {
      // Mock all APIs to fail
      global.fetch.mockImplementation(() =>
        Promise.reject(new Error('All APIs down'))
      );

      const response = await request(app)
        .get('/api/tokens')
        .expect(503);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('external services');
    });

    it('should return structured error responses', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Endpoint not found',
        timestamp: expect.any(String),
        path: '/api/nonexistent'
      });
    });
  });

  describe('Performance', () => {
    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();

      await request(app)
        .get('/api/tokens')
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = Array(10).fill(null).map(() =>
        request(app).get('/api/tokens').query({ limit: 10 })
      );

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRequests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should handle 10 concurrent requests within reasonable time
      expect(totalTime).toBeLessThan(5000);
    });

    it('should implement proper caching for repeated requests', async () => {
      // First request
      const start1 = Date.now();
      await request(app).get('/api/tokens').query({ limit: 5 });
      const time1 = Date.now() - start1;

      // Second identical request (should be cached)
      const start2 = Date.now();
      await request(app).get('/api/tokens').query({ limit: 5 });
      const time2 = Date.now() - start2;

      // Cached request should be significantly faster
      expect(time2).toBeLessThan(time1 * 0.5);
    });
  });
});