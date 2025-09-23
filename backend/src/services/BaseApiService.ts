// Base service class for external API integrations
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from '../config/logger';
import { ApiError, RateLimitError } from '../types';
import { prisma } from '../config/database';

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
}

export interface ApiServiceConfig {
  baseUrl: string;
  apiKey?: string;
  rateLimit: number; // requests per minute
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export abstract class BaseApiService {
  protected client: AxiosInstance;
  protected rateLimitInfo: Map<string, RateLimitInfo> = new Map();
  protected requestCount: Map<string, number> = new Map();
  protected lastResetTime: Map<string, Date> = new Map();

  constructor(
    protected config: ApiServiceConfig,
    protected serviceName: string
  ) {
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        'User-Agent': 'Memecoin-Trading-Bot/1.0',
        ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
    this.setupRateLimitReset();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      async (config) => {
        await this.checkRateLimit(config.url || '');
        this.incrementRequestCount(config.url || '');

        logger.debug(`Making ${this.serviceName} API request`, {
          url: config.url,
          method: config.method,
        });

        return config;
      },
      (error) => {
        logger.error(`${this.serviceName} request error:`, error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        this.updateRateLimitInfo(response);
        this.logApiUsage(response, true);

        logger.debug(`${this.serviceName} API response received`, {
          status: response.status,
          url: response.config.url,
        });

        return response;
      },
      async (error) => {
        this.logApiUsage(error.response, false);

        if (error.response?.status === 429) {
          const resetTime = this.extractResetTime(error.response);
          logger.warn(`${this.serviceName} rate limit hit`, {
            resetTime,
            url: error.config?.url,
          });
          throw new RateLimitError(this.serviceName, resetTime);
        }

        if (error.response?.status >= 500 && this.config.retryAttempts) {
          return this.retryRequest(error.config, error);
        }

        logger.error(`${this.serviceName} API error:`, {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url,
        });

        throw new ApiError(
          error.response?.data?.message || error.message,
          error.response?.status || 500,
          this.serviceName
        );
      }
    );
  }

  private async checkRateLimit(endpoint: string): Promise<void> {
    const key = this.getRateLimitKey(endpoint);
    const currentCount = this.requestCount.get(key) || 0;

    if (currentCount >= this.config.rateLimit) {
      const resetTime = this.lastResetTime.get(key) || new Date();
      const waitTime = resetTime.getTime() - Date.now();

      if (waitTime > 0) {
        logger.warn(`Rate limit reached for ${this.serviceName}, waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  private incrementRequestCount(endpoint: string): void {
    const key = this.getRateLimitKey(endpoint);
    const currentCount = this.requestCount.get(key) || 0;
    this.requestCount.set(key, currentCount + 1);
  }

  private setupRateLimitReset(): void {
    setInterval(() => {
      this.requestCount.clear();
      const resetTime = new Date(Date.now() + 60000); // Reset in 1 minute

      for (const key of this.lastResetTime.keys()) {
        this.lastResetTime.set(key, resetTime);
      }
    }, 60000); // Reset every minute
  }

  private updateRateLimitInfo(response: AxiosResponse): void {
    const headers = response.headers;
    const endpoint = response.config.url || '';
    const key = this.getRateLimitKey(endpoint);

    // Try to extract rate limit info from common header patterns
    let limit: number | undefined;
    let remaining: number | undefined;
    let resetTime: Date | undefined;

    // Check for X-RateLimit-* headers
    if (headers['x-ratelimit-limit']) {
      limit = parseInt(headers['x-ratelimit-limit']);
    }
    if (headers['x-ratelimit-remaining']) {
      remaining = parseInt(headers['x-ratelimit-remaining']);
    }
    if (headers['x-ratelimit-reset']) {
      resetTime = new Date(parseInt(headers['x-ratelimit-reset']) * 1000);
    }

    // Check for alternative header patterns
    if (!limit && headers['ratelimit-limit']) {
      limit = parseInt(headers['ratelimit-limit']);
    }
    if (!remaining && headers['ratelimit-remaining']) {
      remaining = parseInt(headers['ratelimit-remaining']);
    }
    if (!resetTime && headers['ratelimit-reset']) {
      resetTime = new Date(parseInt(headers['ratelimit-reset']) * 1000);
    }

    if (limit && remaining !== undefined && resetTime) {
      this.rateLimitInfo.set(key, {
        limit,
        remaining,
        resetTime,
      });
    }
  }

  private extractResetTime(response: AxiosResponse): Date | undefined {
    const headers = response.headers;

    if (headers['x-ratelimit-reset']) {
      return new Date(parseInt(headers['x-ratelimit-reset']) * 1000);
    }
    if (headers['ratelimit-reset']) {
      return new Date(parseInt(headers['ratelimit-reset']) * 1000);
    }
    if (headers['retry-after']) {
      return new Date(Date.now() + parseInt(headers['retry-after']) * 1000);
    }

    // Default to 1 minute from now
    return new Date(Date.now() + 60000);
  }

  private async retryRequest(
    config: AxiosRequestConfig,
    originalError: any,
    attempt: number = 1
  ): Promise<AxiosResponse> {
    if (attempt > (this.config.retryAttempts || 3)) {
      throw originalError;
    }

    const delay = (this.config.retryDelay || 1000) * Math.pow(2, attempt - 1);
    logger.info(`Retrying ${this.serviceName} request (attempt ${attempt})`, {
      url: config.url,
      delay,
    });

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      return await this.client.request(config);
    } catch (error) {
      return this.retryRequest(config, error, attempt + 1);
    }
  }

  private async logApiUsage(
    response: AxiosResponse | undefined,
    success: boolean
  ): Promise<void> {
    try {
      const now = new Date();
      const hour = now.toISOString().slice(0, 13); // YYYY-MM-DD-THH

      await prisma.apiUsage.upsert({
        where: {
          provider_endpoint_hour: {
            provider: this.serviceName,
            endpoint: response?.config.url || 'unknown',
            hour,
          },
        },
        update: {
          requestCount: {
            increment: 1,
          },
          responseTime: response?.headers['x-response-time']
            ? parseInt(response.headers['x-response-time'])
            : undefined,
          statusCode: response?.status,
          rateLimitHit: response?.status === 429,
        },
        create: {
          provider: this.serviceName,
          endpoint: response?.config.url || 'unknown',
          method: response?.config.method?.toUpperCase() || 'GET',
          hour,
          requestCount: 1,
          responseTime: response?.headers['x-response-time']
            ? parseInt(response.headers['x-response-time'])
            : undefined,
          statusCode: response?.status,
          rateLimitHit: response?.status === 429,
        },
      });
    } catch (error) {
      logger.error('Failed to log API usage:', error);
    }
  }

  private getRateLimitKey(endpoint: string): string {
    return `${this.serviceName}:${endpoint}`;
  }

  // Protected methods for subclasses
  protected async get<T>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  protected async post<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  protected async put<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  protected async delete<T>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }

  // Public methods
  public getRateLimitStatus(endpoint: string = ''): RateLimitInfo | undefined {
    const key = this.getRateLimitKey(endpoint);
    return this.rateLimitInfo.get(key);
  }

  public getCurrentRequestCount(endpoint: string = ''): number {
    const key = this.getRateLimitKey(endpoint);
    return this.requestCount.get(key) || 0;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/health', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}