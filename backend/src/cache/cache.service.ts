import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { gzipSync, gunzipSync } from 'node:zlib';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

type CacheEnvelope =
  | { v: 1; encoding: 'json'; payload: string }
  | { v: 1; encoding: 'gzip+base64'; payload: string };

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly redis?: Redis;

  // Only compress "large" payloads (bytes of JSON string).
  private readonly compressThresholdBytes = 8 * 1024;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    const host = process.env.REDIS_HOST;
    const port = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined;

    if (redisUrl) {
      this.redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
    } else if (host || port) {
      this.redis = new Redis({
        host: host ?? '127.0.0.1',
        port: port ?? 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        // ignore shutdown issues
      }
    }
  }

  private async ensureRedisConnected(): Promise<Redis | undefined> {
    if (!this.redis) return undefined;
    if (this.redis.status === 'ready') return this.redis;
    try {
      await this.redis.connect();
      return this.redis;
    } catch (err) {
      this.logger.warn(`Redis unavailable, falling back to in-memory cache: ${String(err?.message ?? err)}`);
      return undefined;
    }
  }

  private encode(value: unknown): string {
    const json = JSON.stringify(value);
    const bytes = Buffer.byteLength(json, 'utf8');
    const envelope: CacheEnvelope =
      bytes >= this.compressThresholdBytes
        ? {
            v: 1,
            encoding: 'gzip+base64',
            payload: gzipSync(Buffer.from(json, 'utf8')).toString('base64'),
          }
        : { v: 1, encoding: 'json', payload: json };
    return JSON.stringify(envelope);
  }

  private decode<T>(raw: string): T | undefined {
    try {
      const parsed = JSON.parse(raw) as CacheEnvelope | unknown;
      if (!parsed || typeof parsed !== 'object') return undefined;
      const envelope = parsed as CacheEnvelope;

      if (envelope.v !== 1) return undefined;
      if (envelope.encoding === 'json') {
        return JSON.parse(envelope.payload) as T;
      }
      if (envelope.encoding === 'gzip+base64') {
        const buf = Buffer.from(envelope.payload, 'base64');
        const json = gunzipSync(buf).toString('utf8');
        return JSON.parse(json) as T;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  async get<T>(key: string): Promise<T | undefined> {
    const redis = await this.ensureRedisConnected();
    if (redis) {
      const raw = await redis.get(key);
      if (!raw) return undefined;
      return this.decode<T>(raw);
    }

    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async set<T>(key: string, value: T, options?: { ttlSeconds?: number }): Promise<void> {
    const ttlSeconds = options?.ttlSeconds ?? 86400;
    const redis = await this.ensureRedisConnected();
    if (redis) {
      await redis.set(key, this.encode(value), 'EX', ttlSeconds);
      return;
    }

    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    const redis = await this.ensureRedisConnected();
    if (redis) {
      await redis.del(key);
      return;
    }
    this.store.delete(key);
  }

  async delPattern(pattern: string): Promise<number> {
    const redis = await this.ensureRedisConnected();
    if (redis) {
      let cursor = '0';
      let deleted = 0;
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 250);
        cursor = nextCursor;
        if (keys.length) {
          deleted += await redis.del(...keys);
        }
      } while (cursor !== '0');
      return deleted;
    }

    // In-memory fallback supports simple prefix patterns like "foo:*".
    if (!pattern.endsWith('*')) return 0;
    const prefix = pattern.slice(0, -1);
    let deleted = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        deleted += 1;
      }
    }
    return deleted;
  }

  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: { ttlSeconds: number },
  ): Promise<{ value: T; cacheHit: boolean }> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) return { value: cached, cacheHit: true };
    const value = await fetchFn();
    await this.set(key, value, { ttlSeconds: options.ttlSeconds });
    return { value, cacheHit: false };
  }
}
