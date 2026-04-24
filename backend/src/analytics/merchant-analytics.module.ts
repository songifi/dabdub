import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from '../payments/entities/payment.entity';
import { MerchantAnalyticsController } from './merchant-analytics.controller';
import { MerchantAnalyticsService } from './merchant-analytics.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment])],
  controllers: [MerchantAnalyticsController],
  providers: [MerchantAnalyticsService],
})
export class MerchantAnalyticsModule {}
