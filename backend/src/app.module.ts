import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { MerchantAnalyticsModule } from './analytics/merchant-analytics.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'default', ttl: 60000, limit: 100 },
        { name: 'authenticated', ttl: 60000, limit: 1000 },
      ],
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
    AdminModule,
    AmlModule,
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
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        getTracker: (req: { ip?: string; body?: { email?: string }; originalUrl?: string; url?: string }) => {
          const path = `${req.originalUrl ?? ''}${req.url ?? ''}`;
          const email = typeof req.body?.email === 'string' ? req.body.email : '';
          if (path.includes('auth/login') && email) {
            return `${req.ip ?? 'unknown'}:${email}`;
          }
          return req.ip ?? 'unknown';
        },
        throttlers: [
          {
            name: 'auth-login',
            ttl: parseInt(String(config.get('THROTTLE_AUTH_TTL_MS', '60000')), 10),
            limit: parseInt(String(config.get('THROTTLE_AUTH_LIMIT', '30')), 10),
          },
        ],
      }),
    }),
  ],
})
export class AppModule {}
