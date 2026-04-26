import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AdminAlertModule } from './alerts/admin-alert.module';
import { AmlModule } from './aml/aml.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { MerchantAnalyticsModule } from './analytics/merchant-analytics.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { MerchantsModule } from './merchants/merchants.module';
import { GroupsModule } from './groups/groups.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { QueueModule } from './queues/queue.module';
import { SettlementsModule } from './settlements/settlements.module';
import { StellarModule } from './stellar/stellar.module';
import { WaitlistModule } from './waitlist/waitlist.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AppThrottlerGuard } from './auth/guards/throttler.guard';
import { EmailModule } from './email/email.module';
import { SentryInterceptor } from './common/interceptors/sentry.interceptor';
import { SentryExceptionFilter } from './common/filters/sentry-exception.filter';
import { SentryModule } from './sentry/sentry.module';
import { CronModule } from './cron/cron.module';
import { PrometheusModule } from './prometheus/prometheus.module';
import { AuditModule } from './audit/audit.module';
import { HttpMetricsInterceptor } from './prometheus/http-metrics.interceptor';

import { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: Number(config.get('THROTTLE_DEFAULT_TTL_MS', 60000)),
            limit: Number(config.get('THROTTLE_DEFAULT_LIMIT', 100)),
          },
          {
            name: 'authenticated',
            ttl: Number(config.get('THROTTLE_AUTHENTICATED_TTL_MS', 60000)),
            limit: Number(config.get('THROTTLE_AUTHENTICATED_LIMIT', 1000)),
          },
        ],
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string | undefined>('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USER', 'postgres'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME', 'cheesepay'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: config.get('NODE_ENV') !== 'production',
        logging: config.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    HealthModule,
    SentryModule,
    PrometheusModule,
    CronModule,
    EmailModule,
    AdminModule,
    AmlModule,
    AnalyticsModule,
    MerchantAnalyticsModule,
    AdminAlertModule,
    AuthModule,
    MerchantsModule,
    GroupsModule,
    NotificationsModule,
    PaymentsModule,
    StellarModule,
    SettlementsModule,
    WebhooksModule,
    WaitlistModule,
    QueueModule,
    AuditModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SentryInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: SentryExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
