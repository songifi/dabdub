/**
 * Example usage of the Redis Cache Service
 *
 * This file demonstrates various ways to use the cache service
 * in your application. These are examples and should be adapted
 * to your specific use cases.
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  CacheService,
  CacheKeyBuilder,
  CacheAside,
  CacheWarmingService,
  CacheTtlStrategies,
} from '../index';

// Example 1: Basic cache usage in a service
@Injectable()
export class UserServiceExample {
  constructor(private readonly cacheService: CacheService) {}

  /**
   * Example: Get user with cache-aside pattern
   */
  async getUser(id: string) {
    const cacheKey = CacheKeyBuilder.user.profile(id);

    // Try cache first
    const user = await this.cacheService.get(cacheKey);
    if (user) {
      return user;
    }

    // Cache miss - fetch from database
    // user = await this.userRepository.findOne(id);

    // Store in cache
    await this.cacheService.set(cacheKey, user, {
      strategy: 'USER_PROFILE',
    });

    return user;
  }

  /**
   * Example: Using getOrSet helper
   */
  async getUserWithGetOrSet(id: string) {
    const cacheKey = CacheKeyBuilder.user.profile(id);

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        // This function is only called on cache miss
        // return await this.userRepository.findOne(id);
        return { id, name: 'John Doe' };
      },
      { strategy: 'USER_PROFILE' },
    );
  }

  /**
   * Example: Cache invalidation on update
   */
  async updateUser(id: string, data: any) {
    // Update in database
    // await this.userRepository.update(id, data);

    // Invalidate cache
    await this.cacheService.invalidate('user', id);
    // Or specifically:
    // await this.cacheService.del(CacheKeyBuilder.user.profile(id));

    return { id, ...data };
  }

  /**
   * Example: Batch operations
   */
  async getMultipleUsers(userIds: string[]) {
    const keys = userIds.map((id) => CacheKeyBuilder.user.profile(id));
    const cachedUsers = await this.cacheService.mget(keys);

    // Find which users need to be fetched
    const missingIds = userIds.filter((_, index) => !cachedUsers[index]);

    if (missingIds.length > 0) {
      // Fetch missing users from database
      // const fetchedUsers = await this.userRepository.findByIds(missingIds);

      // Cache the fetched users
      const entries = missingIds.map((id, index) => ({
        key: CacheKeyBuilder.user.profile(id),
        value: { id, name: `User ${id}` }, // fetchedUsers[index]
        ttl: CacheTtlStrategies.USER_PROFILE,
      }));

      await this.cacheService.mset(entries);
    }

    return cachedUsers;
  }
}

// Example 2: Using CacheAside decorator
@Injectable()
export class PaymentServiceExample {
  constructor(private readonly cacheService: CacheService) {}

  @CacheAside({
    key: (args) => CacheKeyBuilder.payment.request(args[0]),
    strategy: 'PAYMENT_REQUEST',
  })
  async getPayment(paymentId: string) {
    // This method result will be automatically cached
    // return await this.paymentRepository.findOne(paymentId);
    return { id: paymentId, amount: 100 };
  }

  @CacheAside({
    key: (args) => CacheKeyBuilder.payment.history(args[0], args[1]),
    strategy: 'PAYMENT_HISTORY',
  })
  async getPaymentHistory(userId: string, page: number) {
    // return await this.paymentRepository.findByUserId(userId, page);
    return [{ id: '1', amount: 100 }];
  }
}

// Example 3: Rate limiting with cache
@Injectable()
export class RateLimitServiceExample {
  constructor(private readonly cacheService: CacheService) {}

  async checkRateLimit(
    ip: string,
    endpoint: string,
    limit: number,
  ): Promise<boolean> {
    const key = CacheKeyBuilder.rateLimit.ip(ip, endpoint);
    const count = await this.cacheService.increment(key);

    if (count === 1) {
      // First request - set TTL
      await this.cacheService.set(key, 1, {
        ttl: CacheTtlStrategies.RATE_LIMIT_WINDOW,
      });
    }

    return count <= limit;
  }

  async resetRateLimit(ip: string, endpoint: string): Promise<void> {
    const key = CacheKeyBuilder.rateLimit.ip(ip, endpoint);
    await this.cacheService.del(key);
  }
}

// Example 4: Cache warming
@Injectable()
export class CacheWarmingExample implements OnModuleInit {
  constructor(
    private readonly cacheService: CacheService,
    private readonly cacheWarmingService: CacheWarmingService,
  ) {}

  onModuleInit() {
    // Register cache warming strategy
    this.cacheWarmingService.registerStrategy({
      name: 'active-users',
      warm: async () => {
        // Get active users
        // const activeUsers = await this.userRepository.findActive();

        // Warm cache
        const activeUsers = [{ id: '1' }, { id: '2' }];
        for (const user of activeUsers) {
          await this.cacheService.set(
            CacheKeyBuilder.user.profile(user.id),
            user,
            { strategy: 'USER_PROFILE' },
          );
        }
      },
      interval: 3600000, // 1 hour
    });
  }
}

// Example 5: Monitoring cache metrics
@Injectable()
export class MetricsExample {
  constructor(private readonly cacheService: CacheService) {}

  getCacheStats() {
    const metrics = this.cacheService.getMetrics();
    return {
      hitRate: `${(metrics.hitRate * 100).toFixed(2)}%`,
      hits: metrics.hits,
      misses: metrics.misses,
      total: metrics.hits + metrics.misses,
      errors: metrics.errors,
    };
  }

  logMetrics() {
    const stats = this.getCacheStats();
    console.log('Cache Statistics:', stats);
  }
}

// Example 6: Graceful fallback handling
@Injectable()
export class FallbackExample {
  constructor(private readonly cacheService: CacheService) {}

  async getDataWithFallback(id: string) {
    // Check if cache is available
    if (!this.cacheService.isAvailable()) {
      console.warn('Cache is unavailable, fetching directly from database');
      // return await this.repository.findOne(id);
      return { id, data: 'from-db' };
    }

    // Use cache
    const cacheKey = CacheKeyBuilder.build('data', id);
    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        // return await this.repository.findOne(id);
        return { id, data: 'from-db' };
      },
      { strategy: 'API_DETAIL' },
    );
  }
}
