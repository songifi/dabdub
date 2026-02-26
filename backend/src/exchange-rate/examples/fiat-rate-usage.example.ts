/**
 * Example usage of FiatExchangeRateService
 *
 * This file demonstrates how to use the fiat exchange rate service
 * in your application.
 */

import { Injectable } from '@nestjs/common';
import { FiatExchangeRateService } from '../fiat-exchange-rate.service';

@Injectable()
export class PaymentConversionService {
  constructor(private readonly fiatRateService: FiatExchangeRateService) {}

  /**
   * Example 1: Convert amount between currencies
   */
  async convertAmount(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<number> {
    const { rate } = await this.fiatRateService.getRate(
      fromCurrency,
      toCurrency,
    );
    return amount * rate;
  }

  /**
   * Example 2: Get rate with cache status
   */
  async getRateWithStatus(fromCurrency: string, toCurrency: string) {
    const result = await this.fiatRateService.getRate(fromCurrency, toCurrency);

    return {
      rate: result.rate,
      cached: result.fromCache,
      stale: result.isStale,
      message: this.getCacheMessage(result.fromCache, result.isStale),
    };
  }

  /**
   * Example 3: Convert USD to multiple African currencies
   */
  async convertUsdToAfricanCurrencies(usdAmount: number) {
    const currencies = ['NGN', 'KES', 'GHS'];
    const conversions = await Promise.all(
      currencies.map(async (currency) => {
        const { rate } = await this.fiatRateService.getRate('USD', currency);
        return {
          currency,
          amount: usdAmount * rate,
          rate,
        };
      }),
    );

    return conversions;
  }

  /**
   * Example 4: Handle stale data gracefully
   */
  async getReliableRate(fromCurrency: string, toCurrency: string) {
    const result = await this.fiatRateService.getRate(fromCurrency, toCurrency);

    if (result.isStale) {
      console.warn(
        `Using stale rate for ${fromCurrency}/${toCurrency}. Fresh data being fetched.`,
      );
    }

    return {
      rate: result.rate,
      reliability: result.isStale ? 'stale' : 'fresh',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Example 5: Validate currency before conversion
   */
  async safeConvert(amount: number, fromCurrency: string, toCurrency: string) {
    const supported = this.fiatRateService.getSupportedCurrencies();

    if (!supported.includes(fromCurrency.toUpperCase())) {
      throw new Error(`Unsupported currency: ${fromCurrency}`);
    }

    if (!supported.includes(toCurrency.toUpperCase())) {
      throw new Error(`Unsupported currency: ${toCurrency}`);
    }

    return this.convertAmount(amount, fromCurrency, toCurrency);
  }

  /**
   * Example 6: Batch conversions with error handling
   */
  async batchConvert(
    conversions: Array<{
      amount: number;
      from: string;
      to: string;
    }>,
  ) {
    const results = await Promise.allSettled(
      conversions.map(async ({ amount, from, to }) => {
        const { rate } = await this.fiatRateService.getRate(from, to);
        return {
          from,
          to,
          originalAmount: amount,
          convertedAmount: amount * rate,
          rate,
        };
      }),
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return { success: true, data: result.value };
      } else {
        return {
          success: false,
          error: result.reason.message,
          input: conversions[index],
        };
      }
    });
  }

  /**
   * Example 7: Force cache refresh
   */
  async forceRefresh(fromCurrency: string, toCurrency: string) {
    // Invalidate cache first
    await this.fiatRateService.invalidateCache(fromCurrency, toCurrency);

    // Fetch fresh rate
    const result = await this.fiatRateService.getRate(fromCurrency, toCurrency);

    return {
      rate: result.rate,
      fresh: !result.fromCache,
    };
  }

  /**
   * Helper: Get human-readable cache message
   */
  private getCacheMessage(fromCache: boolean, isStale: boolean): string {
    if (!fromCache) {
      return 'Fresh data from provider';
    }
    if (isStale) {
      return 'Stale cached data (revalidating in background)';
    }
    return 'Fresh cached data';
  }
}

/**
 * Example API Controller Usage
 */
import { Controller, Get, Query, Post, Body } from '@nestjs/common';

@Controller('payments')
export class PaymentController {
  constructor(private readonly conversionService: PaymentConversionService) {}

  @Get('convert')
  async convert(
    @Query('amount') amount: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const convertedAmount = await this.conversionService.convertAmount(
      parseFloat(amount),
      from,
      to,
    );

    return {
      original: {
        amount: parseFloat(amount),
        currency: from.toUpperCase(),
      },
      converted: {
        amount: convertedAmount,
        currency: to.toUpperCase(),
      },
    };
  }

  @Post('batch-convert')
  async batchConvert(
    @Body()
    body: {
      conversions: Array<{ amount: number; from: string; to: string }>;
    },
  ) {
    return this.conversionService.batchConvert(body.conversions);
  }

  @Get('rate-status')
  async getRateStatus(@Query('from') from: string, @Query('to') to: string) {
    return this.conversionService.getRateWithStatus(from, to);
  }
}

/**
 * Example HTTP Requests
 *
 * 1. Simple conversion:
 *    GET /payments/convert?amount=100&from=USD&to=NGN
 *
 * 2. Check rate status:
 *    GET /payments/rate-status?from=USD&to=EUR
 *
 * 3. Batch conversion:
 *    POST /payments/batch-convert
 *    {
 *      "conversions": [
 *        { "amount": 100, "from": "USD", "to": "NGN" },
 *        { "amount": 50, "from": "EUR", "to": "GBP" },
 *        { "amount": 200, "from": "USD", "to": "KES" }
 *      ]
 *    }
 */
