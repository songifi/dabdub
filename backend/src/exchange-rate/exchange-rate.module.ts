import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ExchangeRateService } from './exchange-rate.service';
import { ExchangeRate } from './exchange-rate.entity';
import { CoinbaseProvider } from './providers/coinbase.provider';
import { BinanceProvider } from './providers/binance.provider';
import { CoinGeckoProvider } from './providers/coingecko.provider';

@Module({
    imports: [
        TypeOrmModule.forFeature([ExchangeRate]),
        HttpModule,
    ],
    providers: [
        ExchangeRateService,
        CoinbaseProvider,
        BinanceProvider,
        CoinGeckoProvider,
    ],
    exports: [ExchangeRateService],
})
export class ExchangeRateModule { }
