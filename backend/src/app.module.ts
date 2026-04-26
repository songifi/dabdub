import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthModule } from "./auth/auth.module";
import { MerchantsModule } from "./merchants/merchants.module";
import { PaymentsModule } from "./payments/payments.module";
import { StellarModule } from "./stellar/stellar.module";
import { SettlementsModule } from "./settlements/settlements.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { WaitlistModule } from "./waitlist/waitlist.module";
import { QueueModule } from "./queue/queue.module";
import { NotificationsModule } from "./notifications/notifications.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    QueueModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        host: config.get("DB_HOST", "localhost"),
        port: config.get<number>("DB_PORT", 5432),
        username: config.get("DB_USER", "postgres"),
        password: config.get("DB_PASSWORD"),
        database: config.get("DB_NAME", "cheesepay"),
        entities: [__dirname + "/**/*.entity{.ts,.js}"],
        synchronize: config.get("NODE_ENV") !== "production",
        logging: config.get("NODE_ENV") === "development",
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    MerchantsModule,
    PaymentsModule,
    StellarModule,
    SettlementsModule,
    WebhooksModule,
    NotificationsModule,
    WaitlistModule,
  ],
})
export class AppModule {}
