import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { GlobalConfigModule } from '../../config/config.module';
import { GlobalConfigService } from '../../config/global-config.service';
import { RedisModule } from '../../common/redis';
import { BullBoardAuthMiddleware } from './middleware/bull-board-auth.middleware';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { SettlementProcessor } from './processors/settlement.processor';
import { ExportProcessor } from './processors/export.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { RefundProcessor } from './processors/refund.processor';
import { ComplianceReportProcessor } from './processors/compliance-report.processor';
import { WebhookProcessor } from './processors/webhook.processor';
import { PaymentExpiryProcessor } from './processors/payment-expiry.processor';
import { JobPermanentFailureService } from './job-permanent-failure.service';
import { ScheduledJobsModule } from './scheduled/scheduled-jobs.module';

@Module({
  imports: [
    GlobalConfigModule,
    RedisModule,
    JwtModule.registerAsync({
      imports: [GlobalConfigModule],
      inject: [GlobalConfigService],
      useFactory: (config: GlobalConfigService) => ({
        secret: config.getApiConfig().jwtSecret,
        signOptions: { expiresIn: config.getApiConfig().jwtExpiry || '24h' },
      } as any),
    }),
    BullModule.forRootAsync({
      imports: [GlobalConfigModule],
      inject: [GlobalConfigService],
      useFactory: (config: GlobalConfigService) => {
        const redis = config.getRedisConfig();
        return {
          connection: {
            host: redis.host,
            port: redis.port,
            password: redis.password ?? undefined,
            db: redis.db ?? 0,
          },
        };
      },
    }),
    BullModule.registerQueue(
      {
        name: 'settlements',
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      },
      {
        name: 'exports',
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: 'fixed', delay: 10000 },
        },
      },
      {
        name: 'notifications',
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
        },
      },
      {
        name: 'refunds',
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 10000 },
        },
      },
      {
        name: 'compliance-reports',
        defaultJobOptions: {
          attempts: 2,
          removeOnComplete: 10,
          removeOnFail: 50,
        },
      },
      {
        name: 'webhooks',
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
        },
      },
      {
        name: 'payment-expiry',
        defaultJobOptions: {
          attempts: 1,
          removeOnComplete: true,
          removeOnFail: { count: 100 },
        },
      },
    ),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature(
      { name: 'settlements', adapter: BullMQAdapter },
      { name: 'exports', adapter: BullMQAdapter },
      { name: 'notifications', adapter: BullMQAdapter },
      { name: 'refunds', adapter: BullMQAdapter },
      { name: 'compliance-reports', adapter: BullMQAdapter },
      { name: 'webhooks', adapter: BullMQAdapter },
      { name: 'payment-expiry', adapter: BullMQAdapter },
    ),
    ScheduledJobsModule,
  ],
  controllers: [JobsController],
  providers: [
    BullBoardAuthMiddleware,
    JobsService,
    JobPermanentFailureService,
    SettlementProcessor,
    ExportProcessor,
    NotificationProcessor,
    RefundProcessor,
    ComplianceReportProcessor,
    WebhookProcessor,
    PaymentExpiryProcessor,
  ],
  exports: [JobsService, BullModule, BullBoardAuthMiddleware],
})
export class JobsModule { }
