import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheService } from '../cache/cache.service';
import { ExchangeRate } from './exchange-rate.entity';
import {
  CoinGeckoFiatProvider,
  OpenExchangeRatesProvider,
  FiatRateProvider,
} from './providers/fiat-rate.provider';

const CACHE_TTL_MS = 60_000; // 60 seconds
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export interface FiatRateResult {
  rate: number;
  fromCache: boolean;
  isStale: boolean;
}

/**
 * Service for fetching and caching fiat-to-fiat exchange rates
 * Supports: USD, NGN, EUR, GBP, KES, GHS
 */
@Injectable()
export class FiatExchangeRateService {
  private readonly logger = new Logger(FiatExchangeRateService.name);
  private readonly supportedCurrencies = [
    'USD',
    'NGN',
    'EUR',
    'GBP',
    'KES',
    'GHS',
  ];
  private readonly providers: FiatRateProvider[];

  constructor(
    private readonly cacheService: CacheService,
    @InjectRepository(ExchangeRate)
    private readonly rateRepository: Repository<ExchangeRate>,
    private readonly coinGeckoProvider: CoinGeckoFiatProvider,
    private readonly openExchangeRatesProvider: OpenExchangeRatesProvider,
  ) {
    this.providers = [coinGeckoProvider, openExchangeRatesProvider];
  }

  /**
   * Get exchange rate between two fiat currencies
   * Implements stale-while-revalidate pattern
   */
  async getRate(
    fromCurrency: string,
    toCurrency: string,
  ): Promise<FiatRateResult> {
    this.validateCurrency(fromCurrency);
    this.validateCurrency(toCurrency);

    // Same currency
    if (fromCurrency === toCurrency) {
      return { rate: 1.0, fromCache: false, isStale: false };
    }

    const cacheKey = this.buildCacheKey(fromCurrency, toCurrency);

    // Try cache first
    const cached = await this.cacheService.get<{
      rate: number;
      timestamp: number;
    }>(cacheKey);

    if (cached) {
      const age = Date.now() - cached.timestamp;
      const isStale = age > CACHE_TTL_MS;

      // If fresh, return immediately
      if (!isStale) {
        this.logger.debug(
          `Cache HIT (fresh): ${fromCurrency}/${toCurrency} = ${cached.rate}`,
        );
        return { rate: cached.rate, fromCache: true, isStale: false };
      }

      // If stale but not too old, return and revalidate in background
      if (age < STALE_THRESHOLD_MS) {
        this.logger.debug(
          `Cache HIT (stale): ${fromCurrency}/${toCurrency} = ${cached.rate}, revalidating...`,
        );

        // Revalidate in background (fire and forget)
        this.revalidateRate(fromCurrency, toCurrency, cacheKey).catch((err) =>
          this.logger.error(`Background revalidation failed: ${err.message}`),
        );

        return { rate: cached.rate, fromCache: true, isStale: true };
      }
    }

    // Cache miss or too stale - fetch fresh
    this.logger.debug(`Cache MISS: ${fromCurrency}/${toCurrency}`);
    return this.fetchAndCacheRate(fromCurrency, toCurrency, cacheKey);
  }

  /**
   * Fetch rate from providers with fallback
   */
  private async fetchAndCacheRate(
    fromCurrency: string,
    toCurrency: string,
    cacheKey: string,
  ): Promise<FiatRateResult> {
    // Try each provider
    for (const provider of this.providers) {
      try {
        const rate = await provider.getRate(fromCurrency, toCurrency);
        this.logger.log(
          `${provider.name}: ${fromCurrency}/${toCurrency} = ${rate}`,
        );

        // Cache the result
        await this.cacheRate(cacheKey, rate);

        // Persist to database
        await this.persistRate(fromCurrency, toCurrency, rate, provider.name);

        return { rate, fromCache: false, isStale: false };
      } catch (error: any) {
        this.logger.warn(
          `${provider.name} failed for ${fromCurrency}/${toCurrency}: ${error.message}`,
        );
        // Continue to next provider
      }
    }

    // All providers failed - try database fallback
    return this.fallbackToDatabase(fromCurrency, toCurrency);
  }

  /**
   * Revalidate rate in background (stale-while-revalidate)
   */
  private async revalidateRate(
    fromCurrency: string,
    toCurrency: string,
    cacheKey: string,
  ): Promise<void> {
    for (const provider of this.providers) {
      try {
        const rate = await provider.getRate(fromCurrency, toCurrency);
        this.logger.log(
          `Revalidated ${fromCurrency}/${toCurrency} = ${rate} via ${provider.name}`,
        );

        await this.cacheRate(cacheKey, rate);
        await this.persistRate(fromCurrency, toCurrency, rate, provider.name);
        return;
      } catch (error: any) {
        this.logger.warn(
          `Revalidation failed with ${provider.name}: ${error.message}`,
        );
      }
    }

    this.logger.error(
      `All providers failed during revalidation for ${fromCurrency}/${toCurrency}`,
    );
  }

  /**
   * Fallback to last known rate from database
   */
  private async fallbackToDatabase(
    fromCurrency: string,
    toCurrency: string,
  ): Promise<FiatRateResult> {
    this.logger.warn(
      `All providers unavailable for ${fromCurrency}/${toCurrency}, attempting database fallback`,
    );

    const pair = `${fromCurrency}-${toCurrency}`;
    const lastRate = await this.rateRepository.findOne({
      where: { pair },
      order: { timestamp: 'DESC' },
    });

    if (lastRate) {
      const age = Date.now() - lastRate.timestamp.getTime();
      this.logger.log(
        `Database fallback: ${fromCurrency}/${toCurrency} = ${lastRate.rate} (age: ${Math.round(age / 1000)}s)`,
      );

      // Cache the fallback value
      const cacheKey = this.buildCacheKey(fromCurrency, toCurrency);
      await this.cacheRate(cacheKey, Number(lastRate.rate));

      return {
        rate: Number(lastRate.rate),
        fromCache: false,
        isStale: true,
      };
    }

    throw new Error(
      `No rate available for ${fromCurrency}/${toCurrency} from any source`,
    );
  }

  /**
   * Cache rate with timestamp
   */
  private async cacheRate(cacheKey: string, rate: number): Promise<void> {
    await this.cacheService.set(
      cacheKey,
      { rate, timestamp: Date.now() },
      { ttl: CACHE_TTL_MS },
    );
  }

  /**
   * Persist rate to database
   */
  private async persistRate(
    fromCurrency: string,
    toCurrency: string,
    rate: number,
    providerName: string,
  ): Promise<void> {
    try {
      const pair = `${fromCurrency}-${toCurrency}`;

      await this.rateRepository.save(
        this.rateRepository.create({
          pair,
          rate,
          metadata: {
            provider: providerName,
            type: 'fiat',
            validUntil: new Date(Date.now() + CACHE_TTL_MS),
          },
        }),
      );
    } catch (error: any) {
      this.logger.error(`Failed to persist rate to database: ${error.message}`);
    }
  }

  /**
   * Build cache key for currency pair
   */
  private buildCacheKey(fromCurrency: string, toCurrency: string): string {
    return `fiat-rate:${fromCurrency}-${toCurrency}`;
  }

  /**
   * Validate currency is supported
   */
  private validateCurrency(currency: string): void {
    if (!this.supportedCurrencies.includes(currency.toUpperCase())) {
      throw new Error(
        `Unsupported currency: ${currency}. Supported: ${this.supportedCurrencies.join(', ')}`,
      );
    }
  }

  /**
   * Get all supported currencies
   */
  getSupportedCurrencies(): string[] {
    return [...this.supportedCurrencies];
  }

  /**
   * Invalidate cache for a currency pair
   */
  async invalidateCache(
    fromCurrency: string,
    toCurrency: string,
  ): Promise<void> {
    const cacheKey = this.buildCacheKey(fromCurrency, toCurrency);
    await this.cacheService.del(cacheKey);
    this.logger.log(`Cache invalidated for ${fromCurrency}/${toCurrency}`);
  }
}
