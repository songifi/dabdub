import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExchangeRate } from './exchange-rate.entity';
import { CoinbaseProvider } from './providers/coinbase.provider';
import { BinanceProvider } from './providers/binance.provider';
import { CoinGeckoProvider } from './providers/coingecko.provider';
import { RateProvider } from './interfaces/rate-provider.interface';

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

    async getRate(pair: string): Promise<number> {
        const cachedRate = await this.cacheManager.get<number>(`rate:${pair}`);
        if (cachedRate) {
            return cachedRate;
        }
        // If not in cache, fetch immediately (could be slow, but ensures availability)
        return this.fetchAndAggregateRate(pair);
    }

    async convertAmount(amount: number, fromCurrency: string, toCurrency: string): Promise<number> {
        const pair = `${fromCurrency}-${toCurrency}`;
        const rate = await this.getRate(pair);
        return amount * rate;
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

        // Outlier Detection
        const validRates = this.filterOutliers(successfulRates);

        // Spread Calculation
        const spread = this.calculateSpread(validRates);

        // Aggregation (Weighted Average)
        let totalWeight = 0;
        let weightedSum = 0;

        for (const item of validRates) {
            const weight = this.providerWeights[item.provider] || 0.1; // Default low weight if unknown
            weightedSum += item.rate * weight;
            totalWeight += weight;
        }

        const averageRate = totalWeight > 0 ? weightedSum / totalWeight : 0;

        // Confidence Score
        const confidence = this.calculateConfidence(validRates.length, this.providers.length, spread);

        this.logger.log(`Aggregated Rate for ${pair}: ${averageRate} (Confidence: ${confidence.toFixed(2)}, Spread: ${spread.toFixed(2)}%)`);

        // Cache
        await this.cacheManager.set(`rate:${pair}`, averageRate, 60000); // 60s TTL

        this.lastSuccessTimestamp.set(pair, Date.now());

        // Store History
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
        return ((max - min) / min) * 100; // Percentage spread
    }

    calculateConfidence(successCount: number, totalProviders: number, spread: number): number {
        if (totalProviders === 0) return 0;
        // Base score: Fraction of successful providers
        let score = successCount / totalProviders;

        // Penalty for high spread
        if (spread > 5.0) { // If spread > 5%, significant penalty
            score *= 0.5;
        } else if (spread > 1.0) { // If spread > 1%, reduce confidence
            score *= 0.8;
        }

        return Math.min(Math.max(score, 0), 1); // Clamp 0-1
    }

    private filterOutliers(rates: { provider: string; rate: number }[]): { provider: string; rate: number }[] {
        if (rates.length <= 2) return rates; // Not enough data to reliably detect outliers

        // Calculate Median
        const sortedDetails = [...rates].sort((a, b) => a.rate - b.rate);
        const mid = Math.floor(sortedDetails.length / 2);
        const median = sortedDetails.length % 2 !== 0
            ? sortedDetails[mid].rate
            : (sortedDetails[mid - 1].rate + sortedDetails[mid].rate) / 2;

        // Filter deviation > 5%
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
