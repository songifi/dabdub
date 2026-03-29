import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RateSnapshot } from './entities/rate-snapshot.entity';
import { CacheService } from '../cache/cache.service';

const STALE_MS = 5 * 60 * 1000;
const RATE_CACHE_TTL_SECONDS = 3600;

type CachedRate = { rate: string; fetchedAt: string; source: string };

export class StaleRateException extends Error {
  constructor() {
    super('Stale rate');
    this.name = 'StaleRateException';
  }
}

@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name);

  constructor(
    @InjectRepository(RateSnapshot)
    private readonly snapshotRepo: Repository<RateSnapshot>,
    private readonly cache: CacheService,
  ) {}

  async getRate(
    base: string,
    quote: string,
  ): Promise<{ rate: string; fetchedAt: Date; source: string; isStale: boolean }> {
    const key = `rate:${base}:${quote}`;
    const cached = await this.cache.get<CachedRate>(key);

    if (cached) {
      return {
        rate: cached.rate,
        fetchedAt: new Date(cached.fetchedAt),
        source: cached.source,
        isStale: false,
      };
    }

    const snapshot = await this.snapshotRepo.findOne({
      where: { base, quote },
      order: { fetchedAt: 'DESC' },
    });

    if (!snapshot) throw new StaleRateException();

    const ageMs = Date.now() - snapshot.fetchedAt.getTime();
    if (ageMs > STALE_MS) throw new StaleRateException();

    return {
      rate: snapshot.rate,
      fetchedAt: snapshot.fetchedAt,
      source: snapshot.source,
      isStale: true,
    };
  }

  async fetchAndCache(): Promise<RateSnapshot> {
    const { rate, source } = await this.fetchFromProvider();
    const fetchedAt = new Date();

    await this.cache.set(
      `rate:USDC:NGN`,
      { rate, fetchedAt: fetchedAt.toISOString(), source },
      RATE_CACHE_TTL_SECONDS,
    );

    const snapshot = await this.snapshotRepo.save(
      this.snapshotRepo.create({
        base: 'USDC',
        quote: 'NGN',
        rate,
        source,
        fetchedAt,
      }),
    );

    this.logger.log(`Rate fetched: ${rate} NGN/USDC from ${source}`);
    return snapshot;
  }

  /**
   * Last 7 days of USDC/NGN, one row per clock hour (mean rate within the hour).
   * Suitable for exchange screen charts without returning every 30s poll row.
   */
  async getRateHistory(): Promise<
    Array<{ fetchedAt: Date; rate: string; source: string }>
  > {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await this.snapshotRepo.manager.query<
      Array<{ bucket: Date; rate: string }>
    >(
      `
      SELECT
        date_trunc('hour', s.fetched_at) AS bucket,
        (AVG(s.rate::numeric))::text AS rate
      FROM rate_snapshots s
      WHERE s.base = $1 AND s.quote = $2 AND s.fetched_at >= $3
      GROUP BY 1
      ORDER BY 1 ASC
      `,
      ['USDC', 'NGN', sevenDaysAgo],
    );

    return rows.map((r) => ({
      fetchedAt: r.bucket,
      rate: r.rate,
      source: 'hourly_avg',
    }));
  }

  /** Converts NGN amount to USDC using the latest stored NGN-per-USDC rate. */
  async convertNgnToUsdc(ngnAmount: number): Promise<number> {
    const snapshot = await this.snapshotRepo.findOne({
      where: { base: 'USDC', quote: 'NGN' },
      order: { fetchedAt: 'DESC' },
    });
    if (!snapshot) throw new StaleRateException();

    const ngnPerUsdc = parseFloat(snapshot.rate);
    return parseFloat((ngnAmount / ngnPerUsdc).toFixed(6));
  }

  private async fetchFromProvider(): Promise<{ rate: string; source: string }> {
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
      body: JSON.stringify({
        userId: '',
        tokenId: 'USDC',
        currencyId: 'NGN',
        side: '1',
        size: '10',
        page: '1',
        amount: '',
      }),
    });
    if (!res.ok) throw new Error(`Bybit HTTP ${res.status}`);
    const data = (await res.json()) as {
      result?: { items?: Array<{ price: string }> };
    };
    const price = data?.result?.items?.[0]?.price;
    if (!price) throw new Error('Bybit: no price in response');
    return { rate: price, source: 'bybit_p2p' };
  }

  private async fetchBinance(): Promise<{ rate: string; source: string }> {
    const res = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        asset: 'USDC',
        fiat: 'NGN',
        tradeType: 'SELL',
        page: 1,
        rows: 1,
      }),
    });
    if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
    const data = (await res.json()) as {
      data?: Array<{ adv?: { price: string } }>;
    };
    const price = data?.data?.[0]?.adv?.price;
    if (!price) throw new Error('Binance: no price in response');
    return { rate: price, source: 'binance_p2p' };
  }
}
