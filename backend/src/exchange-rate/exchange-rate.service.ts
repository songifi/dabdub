import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ExchangeRate } from './exchange-rate.entity';
import { RateSource } from './enums/rate-source.enum';
import { CoinbaseProvider } from './providers/coinbase.provider';
import { BinanceProvider } from './providers/binance.provider';
import { CoinGeckoProvider } from './providers/coingecko.provider';
import { RateProvider } from './interfaces/rate-provider.interface';

const CACHE_TTL_MS = 60_000; // 60 s

@Injectable()
export class ExchangeRateService {
    private readonly logger = new Logger(ExchangeRateService.name);
    private providers: RateProvider[] = [];

    // Configurable pairs
    private readonly monitoredPairs = ['BTC-USD', 'ETH-USD'];
    private readonly lastSuccessTimestamp: Map<string, number> = new Map();

    private readonly providerWeights: Record<string, number> = {
        'Coinbase': 0.4,
        'Binance': 0.4,
        'CoinGecko': 0.2,
    };

    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        @InjectRepository(ExchangeRate)
        private rateRepository: Repository<ExchangeRate>,
        private readonly coinbaseProvider: CoinbaseProvider,
        private readonly binanceProvider: BinanceProvider,
        private readonly coinGeckoProvider: CoinGeckoProvider,
    ) {
        this.providers = [
            this.coinbaseProvider,
            this.binanceProvider,
            this.coinGeckoProvider,
        ];
    }

    /** Get rate by pair string or (crypto, fiat). Used by controller and other modules. */
    async getRate(cryptoOrPair: string, fiatCurrency?: string): Promise<number> {
        const pair = fiatCurrency ? `${cryptoOrPair}-${fiatCurrency}` : cryptoOrPair;
        const cachedRate = await this.cacheManager.get<number>(`rate:${pair}`);
        if (cachedRate) {
            return cachedRate;
        }
        return this.fetchAndAggregateRate(pair);
    }

    /**
     * Fiat-to-USD rate for payment request creation. Cached (TTL 60s).
     * Use for converting fiat amount to USDC (1 USD ≈ 1 USDC).
     */
    async getFiatToUsdRate(currency: string): Promise<number> {
        const normalized = currency.toUpperCase();
        if (normalized === 'USD') return 1;

        const cacheKey = `rate:${normalized}-USD`;
        const cached = await this.cacheManager.get<number>(cacheKey);
        if (cached !== null && cached !== undefined) return cached;

        try {
            const rate = await this.coinbaseProvider.getRate(`${normalized}-USD`);
            await this.cacheManager.set(cacheKey, rate, CACHE_TTL_MS);
            return rate;
        } catch (e: any) {
            this.logger.warn(
                `Fiat rate for ${normalized}-USD failed: ${e?.message}. Using 1 as fallback.`,
            );
            await this.cacheManager.set(cacheKey, 1, CACHE_TTL_MS);
            return 1;
        }
    }

    async convertAmount(amount: number, fromCurrency: string, toCurrency: string): Promise<number> {
        const pair = `${fromCurrency}-${toCurrency}`;
        const rate = await this.getRate(pair);
        return amount * rate;
    }

    /** For controller GET /exchange-rates/history – uses entity pair + timestamp. */
    async getHistoricalRates(
        cryptoCurrency: string,
        fiatCurrency: string,
        from: Date,
        to: Date,
        _source: RateSource = RateSource.AGGREGATED,
    ): Promise<ExchangeRate[]> {
        const pair = `${cryptoCurrency}-${fiatCurrency}`;
        return this.rateRepository.find({
            where: {
                pair,
                timestamp: Between(from, to),
            },
            order: { timestamp: 'ASC' },
        });
    }

    @Cron(CronExpression.EVERY_MINUTE)
    async handleCron() {
        this.logger.log('Starting scheduled rate update...');
        for (const pair of this.monitoredPairs) {
            try {
                await this.fetchAndAggregateRate(pair);
            } catch (e: any) {
                this.logger.error(`Cron update failed for ${pair}: ${e.message}`);
            }
        }
        this.logger.log('Scheduled rate update completed.');
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async checkStaleness() {
        const STALENESS_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
        const now = Date.now();

        for (const pair of this.monitoredPairs) {
            const lastUpdate = this.lastSuccessTimestamp.get(pair) || 0;
            if (now - lastUpdate > STALENESS_THRESHOLD_MS) {
                this.logger.error(`ALERT: Rate for ${pair} is STALE! Last update was at ${new Date(lastUpdate).toISOString()}`);
            }
        }
    }

    async fetchAndAggregateRate(pair: string): Promise<number> {
        this.logger.debug(`Fetching rates for ${pair}...`);

        const results = await Promise.allSettled(
            this.providers.map(p => p.getRate(pair).then(rate => ({ provider: p.name, rate })))
        );

        const successfulRates: { provider: string; rate: number }[] = [];
        const errors: string[] = [];

        for (const result of results) {
            if (result.status === 'fulfilled') {
                successfulRates.push(result.value);
            } else {
                errors.push(result.reason.message);
            }
        }

        if (successfulRates.length === 0) {
            this.logger.warn(`All rate providers failed for ${pair}. Attempting database fallback...`);
            const lastRate = await this.rateRepository.findOne({
                where: { pair },
                order: { timestamp: 'DESC' }
            });

            if (lastRate) {
                this.logger.log(`Fallback successful: Using last known rate for ${pair} from ${lastRate.timestamp.toISOString()}: ${lastRate.rate}`);
                return Number(lastRate.rate);
            }

            this.logger.error(`Critical: All providers failed and no historical data found for ${pair}`);
            throw new Error(`Failed to get rate for ${pair} from all sources (including database).`);
        }

        const validRates = this.filterOutliers(successfulRates);
        const spread = this.calculateSpread(validRates);
        let totalWeight = 0;
        let weightedSum = 0;

        for (const item of validRates) {
            const weight = this.providerWeights[item.provider] || 0.1;
            weightedSum += item.rate * weight;
            totalWeight += weight;
        }

        const averageRate = totalWeight > 0 ? weightedSum / totalWeight : 0;
        const confidence = this.calculateConfidence(validRates.length, this.providers.length, spread);

        this.logger.log(`Aggregated Rate for ${pair}: ${averageRate} (Confidence: ${confidence.toFixed(2)}, Spread: ${spread.toFixed(2)}%)`);

        await this.cacheManager.set(`rate:${pair}`, averageRate, CACHE_TTL_MS);
        this.lastSuccessTimestamp.set(pair, Date.now());

        await this.rateRepository.save({
            pair,
            rate: averageRate,
            metadata: {
                raw: successfulRates,
                valid: validRates,
                errors,
                spread,
                confidence
            }
        });

        return averageRate;
    }

    calculateSpread(rates: { rate: number }[]): number {
        if (rates.length < 2) return 0;
        const prices = rates.map(r => r.rate);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        if (min === 0) return 0;
        return ((max - min) / min) * 100;
    }

    calculateConfidence(successCount: number, totalProviders: number, spread: number): number {
        if (totalProviders === 0) return 0;
        let score = successCount / totalProviders;
        if (spread > 5.0) score *= 0.5;
        else if (spread > 1.0) score *= 0.8;
        return Math.min(Math.max(score, 0), 1);
    }

    private filterOutliers(rates: { provider: string; rate: number }[]): { provider: string; rate: number }[] {
        if (rates.length <= 2) return rates;

        const sortedDetails = [...rates].sort((a, b) => a.rate - b.rate);
        const mid = Math.floor(sortedDetails.length / 2);
        const median = sortedDetails.length % 2 !== 0
            ? sortedDetails[mid].rate
            : (sortedDetails[mid - 1].rate + sortedDetails[mid].rate) / 2;

        const THRESHOLD_PERCENT = 0.05;
        return rates.filter(item => {
            const deviation = Math.abs(item.rate - median) / median;
            const isOutlier = deviation > THRESHOLD_PERCENT;
            if (isOutlier) {
                this.logger.warn(`Outlier detected: ${item.provider} rate ${item.rate} deviates by ${(deviation * 100).toFixed(2)}% from median ${median}`);
            }
            return !isOutlier;
        });
    }
}
