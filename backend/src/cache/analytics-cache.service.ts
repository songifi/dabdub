import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as zlib from 'zlib';
import { promisify } from 'util';
import Redis from 'ioredis';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/** Payloads at or above this UTF-8 byte length are gzip-compressed before storage. */
const DEFAULT_MIN_COMPRESS_BYTES = 1024;

const MERCHANT_TTL_SEC = 300; // 5 minutes
const ADMIN_TTL_SEC = 600; // 10 minutes

@Injectable()
export class AnalyticsCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsCacheService.name);
  private readonly minCompressBytes: number;
  private readonly memory = new Map<string, { payload: string; expiresAt: number }>();
  private redis: Redis | null = null;

  constructor(private readonly config: ConfigService) {
    this.minCompressBytes = Number(
      this.config.get('ANALYTICS_CACHE_MIN_COMPRESS_BYTES', DEFAULT_MIN_COMPRESS_BYTES),
    );
    const host = this.config.get<string>('REDIS_HOST');
    if (host) {
      this.redis = new Redis({
        host,
        port: Number(this.config.get('REDIS_PORT', 6379)),
        password: this.config.get<string>('REDIS_PASSWORD') || undefined,
        maxRetriesPerRequest: 2,
      });
    }
  }

  onModuleDestroy(): void {
    this.redis?.disconnect();
  }

  /** `analytics:{merchantId}:{endpoint}:{dateRange}` */
  buildKey(merchantId: string, endpoint: string, dateRange: string): string {
    return `analytics:${merchantId}:${endpoint}:${dateRange}`;
  }

  async getParsed<T>(
    merchantId: string,
    endpoint: string,
    dateRange: string,
    audience: 'merchant' | 'admin',
  ): Promise<T | null> {
    const key = this.buildKey(merchantId, endpoint, dateRange);
    const raw = await this.getRaw(key);
    if (raw == null) return null;
    try {
      return (await this.unpackAsync(raw)) as T;
    } catch (e) {
      this.logger.warn(`Corrupt analytics cache entry for ${key}; deleting`);
      await this.delKey(key);
      return null;
    }
  }

  async setParsed<T>(
    merchantId: string,
    endpoint: string,
    dateRange: string,
    audience: 'merchant' | 'admin',
    value: T,
  ): Promise<void> {
    const key = this.buildKey(merchantId, endpoint, dateRange);
    const ttl = audience === 'admin' ? ADMIN_TTL_SEC : MERCHANT_TTL_SEC;
    const packed = await this.pack(value);
    await this.setRaw(key, packed, ttl);
  }

  /**
   * After a payment settles, drop cached analytics for that merchant and admin rollups.
   */
  async invalidateAfterPaymentSettled(merchantId: string): Promise<void> {
    await Promise.all([
      this.deleteByPrefix(`analytics:${merchantId}:`),
      this.deleteByPrefix('analytics:admin:'),
    ]);
  }

  /** Test helper: clear in-memory entries (and no-op for Redis in unit tests). */
  clearAllForTesting(): void {
    this.memory.clear();
  }

  private async getRaw(key: string): Promise<string | null> {
    if (this.redis) {
      try {
        return await this.redis.get(key);
      } catch (e) {
        this.logger.warn(`Redis GET failed for ${key}: ${(e as Error).message}`);
        return null;
      }
    }
    const row = this.memory.get(key);
    if (!row) return null;
    if (Date.now() > row.expiresAt) {
      this.memory.delete(key);
      return null;
    }
    return row.payload;
  }

  private async setRaw(key: string, payload: string, ttlSec: number): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.set(key, payload, 'EX', ttlSec);
        return;
      } catch (e) {
        this.logger.warn(`Redis SET failed for ${key}: ${(e as Error).message}`);
      }
    }
    this.memory.set(key, { payload, expiresAt: Date.now() + ttlSec * 1000 });
  }

  private async delKey(key: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.del(key);
      } catch {
        /* ignore */
      }
    }
    this.memory.delete(key);
  }

  private async deleteByPrefix(prefix: string): Promise<void> {
    const pattern = `${prefix}*`;
    if (this.redis) {
      try {
        let cursor = '0';
        do {
          const [next, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
          cursor = next;
          if (keys.length) await this.redis.del(...keys);
        } while (cursor !== '0');
      } catch (e) {
        this.logger.warn(`Redis SCAN/DEL failed for ${pattern}: ${(e as Error).message}`);
      }
    }
    for (const k of [...this.memory.keys()]) {
      if (k.startsWith(prefix)) this.memory.delete(k);
    }
  }

  private async pack(value: unknown): Promise<string> {
    const json = JSON.stringify(value);
    const bytes = Buffer.byteLength(json, 'utf8');
    if (bytes >= this.minCompressBytes) {
      const gz = await gzip(Buffer.from(json, 'utf8'));
      return `gzip:${gz.toString('base64')}`;
    }
    return `plain:${json}`;
  }

  private async unpackAsync(raw: string): Promise<unknown> {
    if (raw.startsWith('gzip:')) {
      const buf = Buffer.from(raw.slice(5), 'base64');
      const out = await gunzip(buf);
      return JSON.parse(out.toString('utf8'));
    }
    if (raw.startsWith('plain:')) {
      return JSON.parse(raw.slice(6));
    }
    return JSON.parse(raw);
  }
}
