import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchantAnalyticsController } from './merchant-analytics.controller';
import { MerchantAnalyticsService } from './merchant-analytics.service';
import { CacheModule } from '../cache/cache.module';
import { Payment } from '../payments/entities/payment.entity';
import { Merchant } from '../merchants/entities/merchant.entity';

@Module({
  imports: [CacheModule, TypeOrmModule.forFeature([Payment, Merchant])],
  controllers: [MerchantAnalyticsController],
  providers: [MerchantAnalyticsService],
})
export class MerchantAnalyticsModule {}
