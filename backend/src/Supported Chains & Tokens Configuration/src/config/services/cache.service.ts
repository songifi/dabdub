import { Injectable, Logger, Inject } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { config } from "../../config";

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const cacheTtl = ttl || config.cache.ttl;
      await this.cacheManager.set(key, value, cacheTtl);
      this.logger.debug(`Cache set: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to set cache ${key}: ${error.message}`);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.cacheManager.get<T>(key);
      this.logger.debug(`Cache get: ${key} - ${value ? "hit" : "miss"}`);
      return value || null;
    } catch (error) {
      this.logger.error(`Failed to get cache ${key}: ${error.message}`);
      return null;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.logger.debug(`Cache deleted: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete cache ${key}: ${error.message}`);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.cacheManager.store.keys();
      const regex = new RegExp(pattern);
      for (const key of keys) {
        if (regex.test(key)) {
          await this.cacheManager.del(key);
        }
      }
      this.logger.debug(`Cache invalidated pattern: ${pattern}`);
    } catch (error) {
      this.logger.error(
        `Failed to invalidate cache pattern ${pattern}: ${error.message}`,
      );
    }
  }

  getChainConfigKey(chainId: string): string {
    return `chain:${chainId}`;
  }

  getChainListKey(): string {
    return "chains:all";
  }

  getTokensKey(chainId?: string): string {
    return chainId ? `tokens:${chainId}` : "tokens:all";
  }

  getTokenKey(id: string): string {
    return `token:${id}`;
  }
}
