import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ExchangeRateService } from './exchange-rate.service';
import { ExchangeRateController } from './exchange-rate.controller';
import { ExchangeRate } from './exchange-rate.entity';
import { CoinbaseProvider } from './providers/coinbase.provider';
import { BinanceProvider } from './providers/binance.provider';
import { CoinGeckoProvider } from './providers/coingecko.provider';
import { FiatExchangeRateService } from './fiat-exchange-rate.service';
import {
  CoinGeckoFiatProvider,
  OpenExchangeRatesProvider,
} from './providers/fiat-rate.provider';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [TypeOrmModule.forFeature([ExchangeRate]), HttpModule, CacheModule],
  controllers: [ExchangeRateController],
  providers: [
    ExchangeRateService,
    CoinbaseProvider,
    BinanceProvider,
    CoinGeckoProvider,
    FiatExchangeRateService,
    CoinGeckoFiatProvider,
    OpenExchangeRatesProvider,
  ],
  exports: [ExchangeRateService, FiatExchangeRateService],
})
export class ExchangeRateModule {}
// import { Module } from '@nestjs/common';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { HttpModule } from '@nestjs/axios';
// import { BullModule } from '@nestjs/bullmq';
// import { ExchangeRateService } from './exchange-rate.service';
// import { ExchangeRate } from './exchange-rate.entity';
// import { ExchangeRateSnapshot } from './entities/exchange-rate-snapshot.entity';
// import { LiquidityProvider } from './entities/liquidity-provider.entity';
// import { CoinbaseProvider } from './providers/coinbase.provider';
// import { BinanceProvider } from './providers/binance.provider';
// import { CoinGeckoProvider } from './providers/coingecko.provider';
// import { RateManagementService } from './rate-management.service';
// import { RateManagementController } from './rate-management.controller';
// import { RateOverrideProcessor } from './rate-override.processor';
// import { ProviderHealthService } from './provider-health.service';
// import { RateSnapshotService } from './rate-snapshot.service';
// import { AuditModule } from '../audit/audit.module';

// @Module({
//     imports: [
//         TypeOrmModule.forFeature([ExchangeRate, ExchangeRateSnapshot, LiquidityProvider]),
//         HttpModule,
//         BullModule.registerQueue({ name: 'rate-overrides' }),
//         AuditModule,
//     ],
//     controllers: [RateManagementController],
//     providers: [
//         ExchangeRateService,
//         RateManagementService,
//         RateOverrideProcessor,
//         ProviderHealthService,
//         RateSnapshotService,
//         CoinbaseProvider,
//         BinanceProvider,
//         CoinGeckoProvider,
//     ],
//     exports: [ExchangeRateService, RateManagementService],
// })
// export class ExchangeRateModule { }
