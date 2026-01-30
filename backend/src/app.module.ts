import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { SentryFilter } from './common/filters/sentry.filter';
import { BullModule } from '@nestjs/bull';
// Controllers & Services
import { AppController } from './app.controller';
import { AppService } from './app.service';
// Config & Core Modules
import { GlobalConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { CacheModule } from '@nestjs/cache-manager';
import { AnalyticsModule } from './analytics/analytics.module';
import { LoggerModule } from './logger/logger.module';
import { SettlementModule } from './settlement/settlement.module';
import { TransactionsModule } from './transactions/transactions.module';
import { HealthModule } from './health/health.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { NotificationModule } from './notification/notification.module';
import { GlobalConfigService } from './config/global-config.service';
import { BlockchainModule } from './blockchain/blockchain.module';
import { AuthModule } from './auth/auth.module';
import { PublicModule } from './public/public.module';
import { PaymentRequestModule } from './payment-request/payment-request.module';
// Middleware
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { EVMModule } from './evm/evm.module';
import { StellarModule } from './stellar/stellar.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { MerchantModule } from './merchant/merchant.module';

import { SentryModule } from '@sentry/nestjs/dist';

@Module({
  imports: [
    SentryModule.forRoot(),
    GlobalConfigModule,
    DatabaseModule,
    CacheModule.register({ isGlobal: true }),
    LoggerModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    BullModule.forRootAsync({
      imports: [GlobalConfigModule],
      useFactory: async (configService: GlobalConfigService) => ({
        redis: {
          host: configService.getRedisConfig().host,
          port: configService.getRedisConfig().port,
        },
      }),
      inject: [GlobalConfigService],
    }),
    NotificationModule,
    AnalyticsModule,
    SettlementModule,
    TransactionsModule,
    BlockchainModule,
    AuthModule,
    StellarModule,
    HealthModule,
    WebhooksModule,
    PublicModule,
    EVMModule,
    PaymentRequestModule,
    MonitoringModule,
    MerchantModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: SentryFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
