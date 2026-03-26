import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigType } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule, appConfig, redisConfig } from './config';
import { CacheModule } from './cache/cache.module';
import { EmailModule } from './email/email.module';
import { RatesModule } from './rates/rates.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { SorobanModule } from './soroban/soroban.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { UploadModule } from './uploads/upload.module';
import { WsModule } from './ws/ws.module';
import { NotificationsModule } from './notifications/notifications.module';
import { LoggingModule } from './logging/logging.module';
import { CorrelationIdMiddleware } from './logging/correlation-id.middleware';
import { HttpLoggingInterceptor } from './logging/http-logging.interceptor';
import { WebhooksModule } from './webhooks/webhooks.module';
import { MerchantsModule } from './merchants/merchants.module';
import { BankAccountsModule } from './bank-accounts/bank-accounts.module';
import { PayLinkModule } from './paylink/paylink.module';

@Module({
  imports: [
    // 1. Config — global, validates all env vars at startup with abortEarly: false.
    AppConfigModule,

    // 1b. Logging — Winston + Nest bridge.
    LoggingModule,

    // 2. Database — owns the TypeORM root connection; see database.module.ts.
    DatabaseModule,

    // 4. Bull — async Redis connection via typed RedisConfig.
    BullModule.forRootAsync({
      inject: [redisConfig.KEY],
      useFactory: (redis: ConfigType<typeof redisConfig>) => ({
        redis: {
          host: redis.host,
          port: redis.port,
          password: redis.password,
        },
      }),
    }),

    // 5. Throttler — rate limiting via typed AppConfig.
    ThrottlerModule.forRootAsync({
      inject: [appConfig.KEY],
      useFactory: (app: ConfigType<typeof appConfig>) => ({
        throttlers: [
          {
            ttl: app.throttleTtl * 1000,
            limit: app.throttleLimit,
          },
        ],
      }),
    }),

    HealthModule,
    SorobanModule,

    // 6. Email — async transactional delivery via ZeptoMail + BullMQ.
    EmailModule,

    // 7. Rates — USDC/NGN live rates with Redis cache + BullMQ polling.
    RatesModule,

    // 8. Auth — register/login/refresh/logout + global JWT guard. — register/login/refresh/logout + global JWT guard.
    AuthModule,

    // 6. File uploads — presign + confirm via Cloudflare R2.
    UploadModule,

    // 7. WebSockets — Socket.io real-time gateway.
    WsModule,

    // 7. Notifications — entity + API + realtime delivery.
    NotificationsModule,

    // 8. Webhooks — subscriptions + signed deliveries + retries.
    WebhooksModule,

    MerchantsModule,

    BankAccountsModule,

    PayLinkModule,
  ],
  providers: [
    // Global guard: every route requires a valid JWT unless decorated @Public().
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}

