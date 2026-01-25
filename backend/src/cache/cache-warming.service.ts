import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheKeyBuilder } from './cache-key-builder';
import { CacheTtlStrategies } from './cache-ttl.config';

export interface CacheWarmingStrategy {
  name: string;
  warm: () => Promise<void>;
  interval?: number; // in milliseconds
}

@Injectable()
export class CacheWarmingService implements OnModuleInit {
  private readonly logger = new Logger(CacheWarmingService.name);
  private warmingIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(private readonly cacheService: CacheService) {}

  async onModuleInit(): Promise<void> {
    // Start warming strategies after a short delay to ensure services are ready
    setTimeout(() => {
      this.startWarmingStrategies();
    }, 5000);
  }

  /**
   * Register and start a cache warming strategy
   */
  registerStrategy(strategy: CacheWarmingStrategy): void {
    this.logger.log(`Registering cache warming strategy: ${strategy.name}`);

    // Execute immediately
    strategy.warm().catch((error) => {
      this.logger.error(
        `Error warming cache for strategy ${strategy.name}:`,
        error,
      );
    });

    // Schedule periodic warming if interval is provided
    if (strategy.interval) {
      const intervalId = setInterval(() => {
        strategy.warm().catch((error) => {
          this.logger.error(
            `Error warming cache for strategy ${strategy.name}:`,
            error,
          );
        });
      }, strategy.interval);

      this.warmingIntervals.set(strategy.name, intervalId);
    }
  }

  /**
   * Start default warming strategies
   */
  private startWarmingStrategies(): void {
    if (!this.cacheService.isAvailable()) {
      this.logger.warn('Cache is not available, skipping cache warming');
      return;
    }

    // Example warming strategies - can be extended based on application needs
    this.registerStrategy({
      name: 'config-warming',
      warm: async () => {
        // Warm configuration cache
        // This is a placeholder - implement based on your config service
        this.logger.debug('Warming configuration cache');
      },
      interval: 3600000, // 1 hour
    });

    this.logger.log('Cache warming strategies started');
  }

  /**
   * Stop all warming strategies
   */
  stopAll(): void {
    this.warmingIntervals.forEach((interval, name) => {
      clearInterval(interval);
      this.logger.log(`Stopped cache warming strategy: ${name}`);
    });
    this.warmingIntervals.clear();
  }

  /**
   * Manually warm cache for a specific key pattern
   */
  async warmPattern(
    pattern: string,
    factory: () => Promise<any[]>,
  ): Promise<void> {
    try {
      const data = await factory();
      const entries = data.map((item, index) => ({
        key: `${pattern}:${index}`,
        value: item,
        ttl: CacheTtlStrategies.API_LIST,
      }));

      await this.cacheService.mset(entries);
      this.logger.log(
        `Warmed cache for pattern: ${pattern} (${entries.length} entries)`,
      );
    } catch (error) {
      this.logger.error(`Error warming cache pattern ${pattern}:`, error);
    }
  }
}
