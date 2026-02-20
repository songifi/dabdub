import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import { RedisService } from './common/redis/redis.service';
import { SentryFilter } from './common/filters/sentry.filter';
import { BullModule } from '@nestjs/bull';
// Controllers & Services
import { AppController } from './app.controller';
import { AppService } from './app.service';
// Config & Core Modules
import { GlobalConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './common/redis';
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
import { MerchantModule } from './merchant/merchant.module';
// Middleware & interceptors
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { AppLogger } from './common/logger/app-logger.service';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { EVMModule } from './evm/evm.module';
import { StellarModule } from './stellar/stellar.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { ExchangeRateModule } from './exchange-rate/exchange-rate.module';

// TODO: Enable Sentry when @sentry/nestjs module is compatible
// import { SentryModule } from '@sentry/nestjs';

@Module({
  imports: [
    // SentryModule.forRoot(), // TODO: Enable when compatible
    GlobalConfigModule,
    DatabaseModule,
    RedisModule,
    LoggerModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [
          { name: 'global', ttl: 60_000, limit: 100 },
          { name: 'auth', ttl: 60_000, limit: 10 },
          { name: 'sensitive', ttl: 60_000, limit: 5 },
        ],
        storage: new ThrottlerStorageRedisService(redis.client),
      }),
    }),
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
    MerchantModule,
    DashboardModule,
    MonitoringModule,
    MerchantModule,
    ExchangeRateModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AppLogger,
    {
      provide: APP_FILTER,
      useClass: SentryFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, RequestContextMiddleware)
      .forRoutes('*');
  }
}
