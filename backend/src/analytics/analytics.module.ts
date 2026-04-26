import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { Payment } from '../payments/entities/payment.entity';
import { Settlement } from '../settlements/entities/settlement.entity';
import { Merchant } from '../merchants/entities/merchant.entity';
import { CacheModule } from '../cache/cache.module';
import {
  AnalyticsExportController,
  AnalyticsExportDownloadController,
} from './analytics-export.controller';
import { AnalyticsExportService, ANALYTICS_EXPORT_QUEUE } from './analytics-export.service';
import { AnalyticsExport } from './entities/analytics-export.entity';
import { AnalyticsExportProcessor } from './analytics-export.processor';
import { EmailModule } from '../email/email.module';
import { DailyPaymentVolume } from './entities/daily-payment-volume.view';
import { AnalyticsRefreshService } from './analytics-refresh.service';
import { CronModule } from '../cron/cron.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Settlement, Merchant, AnalyticsExport, DailyPaymentVolume]),
    BullModule.registerQueue({ name: ANALYTICS_EXPORT_QUEUE }),
    EmailModule,
    CacheModule,
    CronModule,
  ],
  controllers: [AnalyticsController, AnalyticsExportController, AnalyticsExportDownloadController],
  providers: [AnalyticsService, AnalyticsExportService, AnalyticsExportProcessor, AnalyticsRefreshService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
