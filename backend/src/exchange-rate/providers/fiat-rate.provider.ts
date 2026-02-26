import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

export interface FiatRateProvider {
  name: string;
  getRate(fromCurrency: string, toCurrency: string): Promise<number>;
}

/**
 * CoinGecko provider for fiat exchange rates
 * Free tier: 10-50 calls/minute
 */
@Injectable()
export class CoinGeckoFiatProvider implements FiatRateProvider {
  public readonly name = 'CoinGecko';
  private readonly logger = new Logger(CoinGeckoFiatProvider.name);
  private readonly baseUrl = 'https://api.coingecko.com/api/v3';

  constructor(private readonly httpService: HttpService) {}

  async getRate(fromCurrency: string, toCurrency: string): Promise<number> {
    try {
      // CoinGecko uses lowercase currency codes
      const from = fromCurrency.toLowerCase();
      const to = toCurrency.toLowerCase();

      // For fiat-to-fiat, we use a stable coin as intermediary (USDT)
      const response = await lastValueFrom(
        this.httpService.get(`${this.baseUrl}/exchange_rates`, {
          timeout: 5000,
        }),
      );

      const rates = response.data?.rates;
      if (!rates) {
        throw new Error('Invalid response from CoinGecko');
      }

      const fromRate = rates[from]?.value;
      const toRate = rates[to]?.value;

      if (!fromRate || !toRate) {
        throw new Error(
          `Rate not found for ${fromCurrency}/${toCurrency} pair`,
        );
      }

      // Calculate cross rate
      return toRate / fromRate;
    } catch (error: any) {
      this.logger.error(
        `CoinGecko fetch failed for ${fromCurrency}/${toCurrency}: ${error.message}`,
      );
      throw error;
    }
  }
}

/**
 * Open Exchange Rates provider
 * Requires API key, free tier: 1000 requests/month
 */
@Injectable()
export class OpenExchangeRatesProvider implements FiatRateProvider {
  public readonly name = 'OpenExchangeRates';
  private readonly logger = new Logger(OpenExchangeRatesProvider.name);
  private readonly baseUrl = 'https://openexchangerates.org/api';
  private readonly apiKey: string;

  constructor(private readonly httpService: HttpService) {
    this.apiKey = process.env.OPEN_EXCHANGE_RATES_API_KEY || '';
    if (!this.apiKey) {
      this.logger.warn('OPEN_EXCHANGE_RATES_API_KEY not configured');
    }
  }

  async getRate(fromCurrency: string, toCurrency: string): Promise<number> {
    if (!this.apiKey) {
      throw new Error('OpenExchangeRates API key not configured');
    }

    try {
      const response = await lastValueFrom(
        this.httpService.get(`${this.baseUrl}/latest.json`, {
          params: {
            app_id: this.apiKey,
            base: 'USD',
            symbols: `${fromCurrency},${toCurrency}`,
          },
          timeout: 5000,
        }),
      );

      const rates = response.data?.rates;
      if (!rates) {
        throw new Error('Invalid response from OpenExchangeRates');
      }

      // If from is USD, return direct rate
      if (fromCurrency === 'USD') {
        const rate = rates[toCurrency];
        if (!rate) {
          throw new Error(`Rate not found for ${toCurrency}`);
        }
        return rate;
      }

      // If to is USD, return inverse
      if (toCurrency === 'USD') {
        const rate = rates[fromCurrency];
        if (!rate) {
          throw new Error(`Rate not found for ${fromCurrency}`);
        }
        return 1 / rate;
      }

      // For cross rates, calculate via USD
      const fromRate = rates[fromCurrency];
      const toRate = rates[toCurrency];

      if (!fromRate || !toRate) {
        throw new Error(
          `Rate not found for ${fromCurrency}/${toCurrency} pair`,
        );
      }

      return toRate / fromRate;
    } catch (error: any) {
      this.logger.error(
        `OpenExchangeRates fetch failed for ${fromCurrency}/${toCurrency}: ${error.message}`,
      );
      throw error;
    }
  }
}
