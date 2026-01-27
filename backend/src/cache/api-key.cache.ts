import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class ApiKeyCache {
  constructor(private readonly redis: Redis) {}

  // Cache for 10 minutes to balance security and performance
  async cacheValidatedKey(rawKey: string, metadata: any) {
    const cacheKey = `auth:apikey:${rawKey}`;
    await this.redis.set(cacheKey, JSON.stringify(metadata), 'EX', 600);
  }

  async getCachedKey(rawKey: string) {
    const cached = await this.redis.get(`auth:apikey:${rawKey}`);
    return cached ? JSON.parse(cached) : null;
  }

  async invalidate(rawKey: string) {
    await this.redis.del(`auth:apikey:${rawKey}`);
  }
}