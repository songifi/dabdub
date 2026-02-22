import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FiatCurrencyConfig } from '../database/entities/fiat-currency-config.entity';
import { Merchant } from '../database/entities/merchant.entity';
import { FiatCurrencyConfigService } from './fiat-currency-config.service';
import { FiatCurrencyConfigController } from './fiat-currency-config.controller';
import { AuditModule } from '../audit/audit.module';
import { ExchangeRateModule } from '../exchange-rate/exchange-rate.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FiatCurrencyConfig, Merchant]),
    AuditModule,
    ExchangeRateModule,
    AuthModule,
  ],
  providers: [FiatCurrencyConfigService],
  controllers: [FiatCurrencyConfigController],
  exports: [FiatCurrencyConfigService],
})
export class FiatCurrencyConfigModule {}
