import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigType } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule, appConfig, redisConfig } from './config';
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
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { WebhooksModule } from './webhooks/webhooks.module';
import { RbacModule } from './rbac/rbac.module';
import { MerchantsModule } from './merchants/merchants.module';
import { UsersModule } from './users/users.module';
import { BankAccountsModule } from './bank-accounts/bank-accounts.module';
import { PayLinkModule } from './paylink/paylink.module';
import { ReceiveModule } from './receive/receive.module';
import { VirtualAccountModule } from './virtual-account/virtual-account.module';
import { AuditModule } from './audit/audit.module';
import { AppConfigModule as RuntimeConfigModule } from './app-config/app-config.module';
import { MaintenanceModeMiddleware } from './app-config/middleware/maintenance-mode.middleware';
import { AdminModule } from './admin/admin.module';
import { EarningsModule } from './earnings/earnings.module';
import { SmsModule } from './sms/sms.module';
import { PasskeyModule } from './passkey/passkey.module';
import { SecurityModule } from './security/security.module';
import { TransactionModule } from './transactions/transactions.module';
import { PushModule } from './push/push.module';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';

@Module({
  imports: [
    // 1. Config — global, validates all env vars at startup with abortEarly: false.
    AppConfigModule,

    // 1a. Schedule — enables @Cron decorators for background jobs.
    ScheduleModule.forRoot(),

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

    // 8. Auth — register/login/refresh/logout + global JWT guard.
    AuthModule,

    // File uploads — presign + confirm via Cloudflare R2.
    UploadModule,

    // WebSockets — Socket.io real-time gateway.
    WsModule,

    // Notifications — entity + API + realtime delivery.
    NotificationsModule,

    // Webhooks — subscriptions + signed deliveries + retries.
    WebhooksModule,

    // RBAC — roles + permissions for admin routes.
    RbacModule,

    MerchantsModule,
    UsersModule,
    SecurityModule,
    BankAccountsModule,
    VirtualAccountModule,
    PayLinkModule,
    ReceiveModule,

    AuditModule,

    // Runtime feature flags + maintenance mode.
    RuntimeConfigModule,

    AdminModule,

    // SMS — OTP + transaction alerts via Termii + BullMQ.
    SmsModule,

    // Push — Firebase Cloud Messaging device token management.
    PushModule,

    // Earnings — yield dashboard, APY display, projections.
    EarningsModule,

    WithdrawalsModule,

    // Transactions — activity history with cursor-based pagination.
    // Passkey/WebAuthn authentication.
    PasskeyModule,
    // 11. Transactions — activity history with cursor-based pagination.
    TransactionModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
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
    consumer.apply(MaintenanceModeMiddleware).forRoutes('*');
  }
}
