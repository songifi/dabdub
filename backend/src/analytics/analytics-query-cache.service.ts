import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { constants, gzipSync, gunzipSync } from 'zlib';

const KEY_PREFIX = 'analytics:';
/** JSON payloads at or above this size are gzip-compressed before storage. */
const COMPRESS_MIN_BYTES = 2048;
const GZIP_PREFIX = Buffer.from([0x7a, 0x67]); // 'zg' magic — gzip payload follows

export type AnalyticsCacheAudience = 'merchant' | 'admin';

@Injectable()
export class AnalyticsQueryCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsQueryCacheService.name);
  private redis: Redis | null = null;
  private redisConnectFailed = false;
  private readonly memory = new Map<string, { encoded: Buffer; expiresAt: number }>();

  constructor(private readonly config: ConfigService) {}

  onModuleDestroy(): void {
    if (this.redis) {
      this.redis.disconnect();
      this.redis = null;
    }
  }

  audienceTtlSeconds(audience: AnalyticsCacheAudience): number {
    return audience === 'admin' ? 600 : 300;
  }

  /**
   * Cache key shape: analytics:{merchantId|all}:{endpoint}:{dateRange}
   * dateRange should already encode any parameters that affect the query.
   */
  buildKey(merchantSegment: string, endpoint: string, dateRange: string): string {
    return `${KEY_PREFIX}${merchantSegment}:${endpoint}:${dateRange}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const client = await this.ensureRedis();
    if (client) {
      try {
        const raw = await client.getBuffer(key);
        if (!raw || raw.length === 0) return null;
        return this.decode(raw) as T;
      } catch (err) {
        this.logger.warn(`Redis analytics cache get failed for ${key}: ${(err as Error).message}`);
        return null;
      }
    }

    const mem = this.memoryGet(key);
    return mem === undefined ? null : (mem as T);
  }

  async set<T>(key: string, value: T, audience: AnalyticsCacheAudience): Promise<void> {
    const encoded = this.encode(value);
    const ttl = this.audienceTtlSeconds(audience);
    const client = await this.ensureRedis();
    if (client) {
      try {
        await client.set(key, encoded, 'EX', ttl);
      } catch (err) {
        this.logger.warn(`Redis analytics cache set failed for ${key}: ${(err as Error).message}`);
      }
      return;
    }

    const expiresAt = Date.now() + ttl * 1000;
    this.memory.set(key, { encoded, expiresAt });
  }

  async invalidateAfterPaymentSettled(merchantId: string): Promise<void> {
    this.deleteMemoryByMerchantSegment(merchantId);
    this.deleteMemoryByMerchantSegment('all');

    const client = await this.ensureRedis();
    if (!client) return;

    await this.scanAndDel(client, `${KEY_PREFIX}${merchantId}:*`);
    await this.scanAndDel(client, `${KEY_PREFIX}all:*`);
  }

  clearAllForTests(): void {
    this.memory.clear();
  }

  private memoryGet<T>(key: string): T | undefined {
    const row = this.memory.get(key);
    if (!row) return undefined;
    if (Date.now() > row.expiresAt) {
      this.memory.delete(key);
      return undefined;
    }
    return this.decode(row.encoded) as T;
  }

  private deleteMemoryByMerchantSegment(merchantSegment: string): void {
    const prefix = `${KEY_PREFIX}${merchantSegment}:`;
    for (const k of this.memory.keys()) {
      if (k.startsWith(prefix)) this.memory.delete(k);
    }
  }

  private async scanAndDel(client: Redis, match: string): Promise<void> {
    let cursor = '0';
    try {
      do {
        const [next, keys] = await client.scan(cursor, 'MATCH', match, 'COUNT', 128);
        cursor = next;
        if (keys.length > 0) {
          await client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err) {
      this.logger.warn(`Redis analytics cache invalidate failed (${match}): ${(err as Error).message}`);
    }
  }

  private async ensureRedis(): Promise<Redis | null> {
    if (this.redisConnectFailed) return null;
    if (process.env.NODE_ENV === 'test') return null;
    if (this.redis) return this.redis;

    const host = this.config.get<string>('REDIS_HOST', 'localhost');
    const port = this.config.get<number>('REDIS_PORT', 6379);
    const password = this.config.get<string | undefined>('REDIS_PASSWORD');

    const client = new Redis({
      host,
      port,
      password: password || undefined,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: false,
      retryStrategy: () => null,
    });

    client.on('error', (err) => {
      this.logger.debug(`Redis analytics cache client error: ${err.message}`);
    });

    try {
      await client.ping();
      this.redis = client;
      return client;
    } catch (err) {
      this.logger.warn(
        `Analytics cache Redis unavailable (${(err as Error).message}); using in-process cache only`,
      );
      try {
        client.disconnect();
      } catch {
        /* ignore */
      }
      this.redisConnectFailed = true;
      return null;
    }
  }

  private encode(value: unknown): Buffer {
    const json = JSON.stringify(value);
    const utf8 = Buffer.from(json, 'utf8');
    if (utf8.length < COMPRESS_MIN_BYTES) {
      return utf8;
    }
    const compressed = gzipSync(utf8, { level: constants.Z_DEFAULT_COMPRESSION });
    return Buffer.concat([GZIP_PREFIX, compressed]);
  }

  private decode(raw: Buffer): unknown {
    if (raw.length >= 2 && raw[0] === GZIP_PREFIX[0] && raw[1] === GZIP_PREFIX[1]) {
      const inflated = gunzipSync(raw.subarray(GZIP_PREFIX.length));
      return JSON.parse(inflated.toString('utf8'));
    }
    return JSON.parse(raw.toString('utf8'));
  }
}
