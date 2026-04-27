import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // Unix timestamp (seconds)
  retryAfter?: number; // seconds until reset
}

// Requests per hour by role
const RATE_LIMITS: Record<string, number> = {
  superadmin: 10_000,
  admin: 5_000,
  merchant: 1_000,
};

const WINDOW_SECONDS = 3600; // 1 hour sliding window

@Injectable()
export class RateLimitService {
  constructor(private readonly cache: CacheService) {}

  async checkApiKeyRateLimit(merchantId: string, role: string): Promise<RateLimitResult> {
    const limit = RATE_LIMITS[role] ?? RATE_LIMITS['merchant'];
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - WINDOW_SECONDS;
    const key = `ratelimit:apikey:${merchantId}`;

    // Sliding window using Redis sorted set
    const redis = (this.cache as any).redis;

    // Remove entries outside the current window
    await redis.zremrangebyscore(key, '-inf', windowStart);

    // Count requests in current window
    const count: number = await redis.zcard(key);

    if (count >= limit) {
      // Get oldest entry to calculate reset time
      const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
      const oldestScore = oldest.length >= 2 ? parseInt(oldest[1], 10) : now;
      const resetAt = oldestScore + WINDOW_SECONDS;
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetAt,
        retryAfter: resetAt - now,
      };
    }

    // Add current request with timestamp as score
    await redis.zadd(key, now, `${now}-${Math.random()}`);
    await redis.expire(key, WINDOW_SECONDS);

    const resetAt = now + WINDOW_SECONDS;
    return {
      allowed: true,
      limit,
      remaining: limit - count - 1,
      resetAt,
    };
  }
}
