import {
  Controller,
  Get,
  Query,
  ParseEnumPipe,
  DefaultValuePipe,
  Delete,
} from '@nestjs/common';
import { ExchangeRateService } from './exchange-rate.service';
import { FiatExchangeRateService } from './fiat-exchange-rate.service';
import { RateSource } from './enums/rate-source.enum';

@Controller('exchange-rates')
export class ExchangeRateController {
  constructor(
    private readonly service: ExchangeRateService,
    private readonly fiatService: FiatExchangeRateService,
  ) {}

  @Get()
  async getCurrentRate(
    @Query('crypto') crypto: string,
    @Query('fiat') fiat: string,
  ) {
    const rate = await this.service.getRate(
      crypto.toUpperCase(),
      fiat.toUpperCase(),
    );
    return { crypto, fiat, rate };
  }

  @Get('history')
  async getHistory(
    @Query('crypto') crypto: string,
    @Query('fiat') fiat: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query(
      'source',
      new DefaultValuePipe(RateSource.AGGREGATED),
      new ParseEnumPipe(RateSource),
    )
    source: RateSource,
  ) {
    return this.service.getHistoricalRates(
      crypto.toUpperCase(),
      fiat.toUpperCase(),
      new Date(from),
      new Date(to),
      source,
    );
  }

  @Get('fiat')
  async getFiatRate(@Query('from') from: string, @Query('to') to: string) {
    const result = await this.fiatService.getRate(
      from.toUpperCase(),
      to.toUpperCase(),
    );
    return {
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      rate: result.rate,
      fromCache: result.fromCache,
      isStale: result.isStale,
    };
  }

  @Get('fiat/supported')
  async getSupportedFiatCurrencies() {
    return {
      currencies: this.fiatService.getSupportedCurrencies(),
    };
  }

  @Delete('fiat/cache')
  async invalidateFiatCache(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    await this.fiatService.invalidateCache(
      from.toUpperCase(),
      to.toUpperCase(),
    );
    return {
      message: `Cache invalidated for ${from.toUpperCase()}/${to.toUpperCase()}`,
    };
  }
}
