import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigType } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule, appConfig, redisConfig } from './config';
import { MerchantAnalyticsModule } from './analytics/merchant-analytics.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { MerchantsModule } from './merchants/merchants.module';
import { PaymentsModule } from './payments/payments.module';
import { StellarModule } from './stellar/stellar.module';
import { SettlementsModule } from './settlements/settlements.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { WaitlistModule } from './waitlist/waitlist.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
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
    MerchantAnalyticsModule,

    // 5. Auth — register/login/refresh/logout + global JWT guard.
    AuthModule,
    MerchantsModule,
    PaymentsModule,
    StellarModule,
    SettlementsModule,
    WebhooksModule,
    WaitlistModule,
  ],
})
export class AppModule {}
