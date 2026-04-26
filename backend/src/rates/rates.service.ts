import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { StellarService } from '../stellar/stellar.service';

export const RATE_CACHE_KEY = 'rate:xlm:usd';
export const RATE_TTL_SECONDS = 30;

@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name);

  constructor(
    private readonly cache: CacheService,
    private readonly stellar: StellarService,
  ) {}

  async getXlmUsdRate(): Promise<number> {
    const { value, cacheHit } = await this.cache.getOrSet<number>(
      RATE_CACHE_KEY,
      () => this.stellar.getXlmUsdRate(),
      { ttlSeconds: RATE_TTL_SECONDS },
    );
    this.logger.debug(`XLM/USD rate ${cacheHit ? 'cache hit' : 'cache miss'}: ${value}`);
    return value;
  }

  async fetchAndCache(): Promise<number> {
    const rate = await this.stellar.getXlmUsdRate();
    await this.cache.set(RATE_CACHE_KEY, rate, { ttlSeconds: RATE_TTL_SECONDS });
    this.logger.debug(`XLM/USD rate refreshed: ${rate}`);
    return rate;
  }
}
