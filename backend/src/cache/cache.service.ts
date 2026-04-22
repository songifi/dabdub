import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.module';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<boolean> {
    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (err) {
      this.logger.warn(`Cache set failed for key "${key}": ${(err as Error).message}`);
      return false;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.unlink(key);
    } catch (err) {
      this.logger.warn(`Cache del failed for key "${key}": ${(err as Error).message}`);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = next;
        if (keys.length) await this.redis.unlink(...keys);
      } while (cursor !== '0');
    } catch (err) {
      this.logger.warn(`Cache delPattern failed for "${pattern}": ${(err as Error).message}`);
    }
  }
}
