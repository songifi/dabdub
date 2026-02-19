import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bull';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { ReportService } from './report.service';
import { RevenueOverviewService } from './revenue-overview.service';
import { RevenueExportService } from './revenue-export.service';
import { RevenueExportProcessor } from './revenue-export.processor';
import { REVENUE_EXPORT_QUEUE } from './revenue-export.processor';
import { Settlement } from '../settlement/entities/settlement.entity';
import { Merchant } from '../database/entities/merchant.entity';
import { PaymentRequest } from '../database/entities/payment-request.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Settlement, Merchant, PaymentRequest]),
    CacheModule.register(),
    BullModule.registerQueue({ name: REVENUE_EXPORT_QUEUE }),
    AuthModule,
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    ReportService,
    RevenueOverviewService,
    RevenueExportService,
    RevenueExportProcessor,
  ],
  exports: [AnalyticsService, ReportService, RevenueOverviewService],
})
export class AnalyticsModule {}
