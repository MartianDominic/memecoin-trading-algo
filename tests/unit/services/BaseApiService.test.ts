import { BaseApiService } from '@backend/services/BaseApiService';
import axios, { AxiosInstance } from 'axios';
import { jest } from '@jest/globals';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

interface MockAxiosInstance {
  get: jest.MockedFunction<AxiosInstance['get']>;
  post: jest.MockedFunction<AxiosInstance['post']>;
  put: jest.MockedFunction<AxiosInstance['put']>;
  delete: jest.MockedFunction<AxiosInstance['delete']>;
  request: jest.MockedFunction<AxiosInstance['request']>;
}

describe('BaseApiService', () => {
  let service: BaseApiService;
  let mockAxiosInstance: MockAxiosInstance;

  beforeEach(() => {
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      request: jest.fn(),
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    service = new BaseApiService({
      baseURL: 'https://api.test.com',
      timeout: 5000,
      rateLimit: {
        requests: 10,
        interval: 60000
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create axios instance with correct config', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.test.com',
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': expect.stringContaining('MemecoinTradingBot')
        }
      });
    });

    it('should setup rate limiting', () => {
      expect(service['rateLimiter']).toBeDefined();
    });
  });

  describe('get method', () => {
    it('should make GET request with correct parameters', async () => {
      const mockResponse = { data: { test: 'data' }, status: 200 };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await service.get('/test-endpoint');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test-endpoint', undefined);
      expect(result).toEqual(mockResponse);
    });

    it('should handle query parameters', async () => {
      const mockResponse = { data: { test: 'data' }, status: 200 };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      await service.get('/test-endpoint', {
        params: { limit: 10, offset: 20 }
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test-endpoint', {
        params: { limit: 10, offset: 20 }
      });
    });

    it('should handle request errors', async () => {
      const mockError = new Error('Network Error');
      mockAxiosInstance.get.mockRejectedValue(mockError);

      await expect(service.get('/test-endpoint')).rejects.toThrow('Network Error');
    });

    it('should respect rate limiting', async () => {
      // Create service with very low rate limit
      const limitedService = new BaseApiService({
        baseURL: 'https://api.test.com',
        rateLimit: {
          requests: 1,
          interval: 1000
        }
      });

      mockAxiosInstance.get.mockResolvedValue({ data: {}, status: 200 });

      // First request should go through
      await limitedService.get('/test1');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);

      // Second request should be rate limited
      const startTime = Date.now();
      await limitedService.get('/test2');
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThan(900); // Should wait ~1000ms
    });
  });

  describe('post method', () => {
    it('should make POST request with data', async () => {
      const mockResponse = { data: { success: true }, status: 201 };
      const postData = { name: 'test', value: 123 };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await service.post('/test-endpoint', postData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/test-endpoint', postData, undefined);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('error handling', () => {
    it('should handle timeout errors', async () => {
      const timeoutError = new Error('timeout of 5000ms exceeded');
      timeoutError.name = 'ECONNABORTED';
      mockAxiosInstance.get.mockRejectedValue(timeoutError);

      await expect(service.get('/slow-endpoint')).rejects.toThrow('timeout of 5000ms exceeded');
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network Error');
      networkError.name = 'ENOTFOUND';
      mockAxiosInstance.get.mockRejectedValue(networkError);

      await expect(service.get('/endpoint')).rejects.toThrow('Network Error');
    });

    it('should handle HTTP error responses', async () => {
      const httpError = {
        response: {
          status: 404,
          data: { error: 'Not Found' }
        },
        isAxiosError: true
      };
      mockAxiosInstance.get.mockRejectedValue(httpError);

      await expect(service.get('/not-found')).rejects.toMatchObject({
        response: {
          status: 404,
          data: { error: 'Not Found' }
        }
      });
    });
  });

  describe('request caching', () => {
    it('should cache GET requests when enabled', async () => {
      const mockResponse = { data: { cached: true }, status: 200 };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      // First request
      const result1 = await service.get('/cacheable-endpoint', {
        cache: { ttl: 5000 }
      });

      // Second identical request should use cache
      const result2 = await service.get('/cacheable-endpoint', {
        cache: { ttl: 5000 }
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });

    it('should not cache POST requests', async () => {
      const mockResponse = { data: { success: true }, status: 200 };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await service.post('/endpoint', { data: 'test1' });
      await service.post('/endpoint', { data: 'test2' });

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('retry mechanism', () => {
    it('should retry failed requests up to max retries', async () => {
      const retryService = new BaseApiService({
        baseURL: 'https://api.test.com',
        retry: {
          attempts: 3,
          delay: 100
        }
      });

      // Mock first two calls to fail, third to succeed
      mockAxiosInstance.get
        .mockRejectedValueOnce(new Error('Temporary Error'))
        .mockRejectedValueOnce(new Error('Temporary Error'))
        .mockResolvedValueOnce({ data: { success: true }, status: 200 });

      const result = await retryService.get('/unreliable-endpoint');

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
      expect(result.data).toEqual({ success: true });
    });

    it('should fail after max retry attempts', async () => {
      const retryService = new BaseApiService({
        baseURL: 'https://api.test.com',
        retry: {
          attempts: 2,
          delay: 50
        }
      });

      mockAxiosInstance.get.mockRejectedValue(new Error('Persistent Error'));

      await expect(retryService.get('/failing-endpoint')).rejects.toThrow('Persistent Error');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });
});