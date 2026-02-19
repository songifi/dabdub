import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { ReportService } from './report.service';
import { RevenueOverviewService } from './revenue-overview.service';
import { RevenueExportService } from './revenue-export.service';
import { RevenueExportProcessor } from './revenue-export.processor';
import { REVENUE_EXPORT_QUEUE } from './revenue-export.processor';
import { SystemAnalyticsService } from './system-analytics.service';
import { Settlement } from '../settlement/entities/settlement.entity';
import { Merchant } from '../database/entities/merchant.entity';
import { PaymentRequest } from '../database/entities/payment-request.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Settlement,
      Merchant,
      PaymentRequest,
      Transaction,
    ]),
    CacheModule.register(),
    BullModule.registerQueue({ name: REVENUE_EXPORT_QUEUE }),
    HttpModule.register({ timeout: 5000, maxRedirects: 5 }),
    AuthModule,
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    ReportService,
    RevenueOverviewService,
    RevenueExportService,
    RevenueExportProcessor,
    SystemAnalyticsService,
  ],
  exports: [AnalyticsService, ReportService, RevenueOverviewService],
})
export class AnalyticsModule {}
