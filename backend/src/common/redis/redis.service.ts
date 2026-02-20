import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './inject-redis.decorator';

@Injectable()
export class RedisService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  get client(): Redis {
    return this.redis;
  }

  async get<T = string>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized =
      typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds != null) {
      await this.redis.set(key, serialized, 'EX', ttlSeconds);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Delete all keys matching a pattern (e.g. 'cache:merchants:*').
   * Uses SCAN to avoid blocking on large key sets.
   * Keys are passed without keyPrefix so that del() applies the prefix correctly.
   */
  async delPattern(pattern: string): Promise<void> {
    const prefix = this.redis.options.keyPrefix || '';
    const fullPattern = prefix ? `${prefix}${pattern}` : pattern;
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        fullPattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        const keysWithoutPrefix = prefix
          ? keys.map((k) => (k.startsWith(prefix) ? k.slice(prefix.length) : k))
          : keys;
        await this.redis.del(...keysWithoutPrefix);
      }
    } while (cursor !== '0');
  }

  async exists(key: string): Promise<boolean> {
    return (await this.redis.exists(key)) === 1;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.redis.expire(key, ttlSeconds);
  }

  async ttl(key: string): Promise<number> {
    return await this.redis.ttl(key);
  }

  async incr(key: string): Promise<number> {
    return await this.redis.incr(key);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.redis.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return await this.redis.hget(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string> | null> {
    const data = await this.redis.hgetall(key);
    if (!data || Object.keys(data).length === 0) return null;
    return data;
  }

  async hdel(key: string, field: string): Promise<void> {
    await this.redis.hdel(key, field);
  }

  async sadd(key: string, ...members: string[]): Promise<void> {
    if (members.length > 0) {
      await this.redis.sadd(key, ...members);
    }
  }

  async smembers(key: string): Promise<string[]> {
    return await this.redis.smembers(key);
  }

  async srem(key: string, member: string): Promise<void> {
    await this.redis.srem(key, member);
  }

  /**
   * Execute a pipeline of commands. Each item is [command, ...args].
   * @example pipeline([['get', 'k1'], ['set', 'k2', 'v2']])
   */
  async pipeline(commands: Array<[string, ...unknown[]]>): Promise<unknown[]> {
    const pipeline = this.redis.pipeline();
    for (const [cmd, ...args] of commands) {
      (pipeline as any)[cmd](...args);
    }
    const results = await pipeline.exec();
    const out: unknown[] = [];
    for (const [err, result] of results ?? []) {
      if (err) throw err;
      out.push(result);
    }
    return out;
  }
}
