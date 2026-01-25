import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import Redis from 'ioredis';
import { CacheMetricsService } from './cache-metrics.service';
import { CacheKeyBuilder } from './cache-key-builder';
import {
  CacheTtl,
  CacheTtlStrategies,
  CacheTtlStrategy,
} from './cache-ttl.config';

export interface CacheOptions {
  ttl?: number;
  strategy?: CacheTtlStrategy;
  skipMetrics?: boolean;
}

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redisClient: Redis | null = null;
  private isRedisAvailable = false;
  private fallbackMode = false;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly metricsService: CacheMetricsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.initializeRedisConnection();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
      this.redisClient = null;
    }
  }

  /**
   * Initialize Redis connection and check availability
   */
  private async initializeRedisConnection(): Promise<void> {
    try {
      // Try to get the underlying Redis client from cache-manager
      const store = (this.cacheManager as any).store;
      if (store && store.client) {
        this.redisClient = store.client as Redis;
        this.isRedisAvailable = await this.checkRedisConnection();
      }
    } catch (error) {
      this.logger.warn(
        'Redis connection check failed, using fallback mode',
        error,
      );
      this.fallbackMode = true;
      this.isRedisAvailable = false;
    }
  }

  /**
   * Check if Redis is available
   */
  private async checkRedisConnection(): Promise<boolean> {
    if (!this.redisClient) {
      return false;
    }

    try {
      await this.redisClient.ping();
      this.logger.log('Redis connection established successfully');
      this.fallbackMode = false;
      return true;
    } catch (error) {
      this.logger.warn('Redis ping failed, entering fallback mode', error);
      this.fallbackMode = true;
      return false;
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | undefined> {
    try {
      const value = await this.cacheManager.get<T>(key);

      if (!options?.skipMetrics) {
        if (value !== undefined && value !== null) {
          this.metricsService.recordHit();
        } else {
          this.metricsService.recordMiss();
        }
      }

      return value;
    } catch (error) {
      this.metricsService.recordError();
      this.logger.error(`Cache get error for key ${key}:`, error);

      // Graceful fallback: return undefined instead of throwing
      if (!this.isRedisAvailable) {
        await this.checkRedisConnection();
      }
      return undefined;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const ttl = this.getTtl(options);
      await this.cacheManager.set(key, value, ttl);

      if (!options?.skipMetrics) {
        this.metricsService.recordSet();
      }
    } catch (error) {
      this.metricsService.recordError();
      this.logger.error(`Cache set error for key ${key}:`, error);

      // Graceful fallback: continue without caching
      if (!this.isRedisAvailable) {
        await this.checkRedisConnection();
      }
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.metricsService.recordDelete();
    } catch (error) {
      this.metricsService.recordError();
      this.logger.error(`Cache delete error for key ${key}:`, error);

      if (!this.isRedisAvailable) {
        await this.checkRedisConnection();
      }
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async delPattern(pattern: string): Promise<number> {
    if (!this.redisClient || !this.isRedisAvailable) {
      return 0;
    }

    try {
      const keys = await this.redisClient.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      const deleted = await this.redisClient.del(...keys);
      this.metricsService.recordDelete();
      return deleted;
    } catch (error) {
      this.metricsService.recordError();
      this.logger.error(`Cache delete pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const value = await this.get(key, { skipMetrics: true });
      return value !== undefined && value !== null;
    } catch (error) {
      this.logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get multiple values from cache
   */
  async mget<T>(keys: string[]): Promise<(T | undefined)[]> {
    const results = await Promise.all(keys.map((key) => this.get<T>(key)));
    return results;
  }

  /**
   * Set multiple values in cache
   */
  async mset<T>(
    entries: Array<{ key: string; value: T; ttl?: number }>,
  ): Promise<void> {
    await Promise.all(
      entries.map(({ key, value, ttl }) => this.set(key, value, { ttl })),
    );
  }

  /**
   * Increment a numeric value in cache
   */
  async increment(key: string, by = 1): Promise<number> {
    if (!this.redisClient || !this.isRedisAvailable) {
      return 0;
    }

    try {
      return await this.redisClient.incrby(key, by);
    } catch (error) {
      this.logger.error(`Cache increment error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Decrement a numeric value in cache
   */
  async decrement(key: string, by = 1): Promise<number> {
    if (!this.redisClient || !this.isRedisAvailable) {
      return 0;
    }

    try {
      return await this.redisClient.decrby(key, by);
    } catch (error) {
      this.logger.error(`Cache decrement error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get or set value using cache-aside pattern
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    const cached = await this.get<T>(key, options);

    if (cached !== undefined && cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Invalidate cache by pattern (namespace)
   */
  async invalidateNamespace(namespace: string): Promise<number> {
    const pattern = CacheKeyBuilder.namespace(namespace);
    return this.delPattern(pattern);
  }

  /**
   * Invalidate cache by entity and identifier
   */
  async invalidate(entity: string, identifier: string | number): Promise<void> {
    const pattern = CacheKeyBuilder.pattern(entity, identifier);
    await this.delPattern(pattern);
  }

  /**
   * Get TTL value from options
   */
  private getTtl(options?: CacheOptions): number {
    if (options?.ttl !== undefined) {
      return options.ttl;
    }
    if (options?.strategy) {
      return CacheTtlStrategies[options.strategy];
    }
    return CacheTtl.VERY_LONG; // Default TTL
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.isRedisAvailable && !this.fallbackMode;
  }

  /**
   * Check if in fallback mode
   */
  isInFallbackMode(): boolean {
    return this.fallbackMode;
  }

  /**
   * Get cache metrics
   */
  getMetrics() {
    return this.metricsService.getMetrics();
  }

  /**
   * Reset cache metrics
   */
  resetMetrics(): void {
    this.metricsService.reset();
  }
}
