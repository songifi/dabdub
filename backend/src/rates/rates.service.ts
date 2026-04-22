import { Injectable, Inject, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import type { ConfigType } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import Redis from 'ioredis';
import { redisConfig } from '../config/redis.config';

const NGN_TO_USDC_RATE_KEY = 'rates:NGN_USDC';
const RATE_UPDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name);

  constructor(
    @InjectRepository(RateSnapshot)
    private readonly snapshotRepo: Repository<RateSnapshot>,
    private readonly cache: CacheService,
  ) {}

  async fetchAndCache(): Promise<RateSnapshot> {
    const { rate, source } = await this.fetchFromProvider();
    const fetchedAt = new Date();

    await this.cache.set(CACHE_KEY, { rate, fetchedAt: fetchedAt.toISOString(), source }, CACHE_TTL);

    const snapshot = await this.snapshotRepo.save(
      this.snapshotRepo.create({ base: 'USDC', quote: 'NGN', rate, source, fetchedAt }),
    );

    this.logger.log(`Rate fetched: ${rate} NGN/USDC from ${source}`);
    return snapshot;
  }

  async getRate(base: string, quote: string): Promise<{ rate: string; fetchedAt: Date; source: string; isStale: boolean }> {
    const key = `rate:${base}:${quote}`;
    const cached = await this.cache.get<CachedRate>(key);

    if (cached) {
      return { rate: cached.rate, fetchedAt: new Date(cached.fetchedAt), source: cached.source, isStale: false };
    }

    const snapshot = await this.snapshotRepo.findOne({
      where: { base, quote },
      order: { fetchedAt: 'DESC' },
    });

    if (!snapshot) throw new StaleRateException();

    const ageMs = Date.now() - snapshot.fetchedAt.getTime();
    if (ageMs > STALE_MS) throw new StaleRateException();

    return { rate: snapshot.rate, fetchedAt: snapshot.fetchedAt, source: snapshot.source, isStale: true };
  }

  private async fetchFromProvider(): Promise<{ rate: string; source: string }> {
    // Try Bybit P2P first, fall back to Binance P2P
    try {
      return await this.fetchBybit();
    } catch (err) {
      this.logger.warn(`Bybit fetch failed: ${(err as Error).message}, trying Binance`);
      return await this.fetchBinance();
    }
  }

  private async fetchBybit(): Promise<{ rate: string; source: string }> {
    const res = await fetch('https://api2.bybit.com/fiat/otc/item/online', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '', tokenId: 'USDC', currencyId: 'NGN', side: '1', size: '10', page: '1', amount: '' }),
    });
    if (!res.ok) throw new Error(`Bybit HTTP ${res.status}`);
    const data = (await res.json()) as { result?: { items?: Array<{ price: string }> } };
    const price = data?.result?.items?.[0]?.price;
    if (!price) throw new Error('Bybit: no price in response');
    return { rate: price, source: 'bybit_p2p' };
  }

  private async fetchBinance(): Promise<{ rate: string; source: string }> {
    const res = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset: 'USDC', fiat: 'NGN', tradeType: 'SELL', page: 1, rows: 1 }),
    });
    if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
    const data = (await res.json()) as { data?: Array<{ adv?: { price: string } }> };
    const price = data?.data?.[0]?.adv?.price;
    if (!price) throw new Error('Binance: no price in response');
    return { rate: price, source: 'binance_p2p' };
  }
}
  private readonly redis: Redis;

  constructor(
    private readonly httpService: HttpService,
    @Inject(redisConfig.KEY)
    redisCfg: ConfigType<typeof redisConfig>,
  ) {
    this.redis = new Redis({
      host: redisCfg.host,
      port: redisCfg.port,
      password: redisCfg.password,
    });
    this.redis.on('error', (err: Error) =>
      this.logger.warn(`Rates Redis error: ${err.message}`),
    );

    // Start periodic rate updates
    this.startRateUpdates();
  }

  async getNgnToUsdcRate(): Promise<number> {
    const cached = await this.redis.get(NGN_TO_USDC_RATE_KEY);
    if (cached) {
      return parseFloat(cached);
    }

    // Fallback rate if no cached value
    return 0.00065;
  }

  async convertNgnToUsdc(ngnAmount: number): Promise<number> {
    const rate = await this.getNgnToUsdcRate();
    return parseFloat((ngnAmount * rate).toFixed(6));
  }

  private async startRateUpdates(): Promise<void> {
    // Initial update
    await this.updateRate();

    // Periodic updates
    setInterval(() => {
      this.updateRate().catch((err) =>
        this.logger.error(`Failed to update NGN/USDC rate: ${err.message}`),
      );
    }, RATE_UPDATE_INTERVAL_MS);
  }

  private async updateRate(): Promise<void> {
    try {
      // This is a placeholder — replace with actual rate API
      // For example, from CoinGecko, CoinMarketCap, or a forex API
      const response = await firstValueFrom(
        this.httpService.get('https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=ngn'),
      );

      const rate = response.data['usd-coin']['ngn'];
      if (rate) {
        const usdcToNgn = 1 / rate; // Invert to get NGN to USDC
        await this.redis.set(NGN_TO_USDC_RATE_KEY, usdcToNgn.toString());
        this.logger.log(`Updated NGN/USDC rate: ${usdcToNgn}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to fetch NGN/USDC rate: ${error.message}`);
    }
  }
}
