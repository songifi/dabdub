import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { QueueConfigService } from "../config/queue-config.service";

@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get("REDIS_HOST", "127.0.0.1"),
          port: configService.get<number>("REDIS_PORT", 6379),
          password: configService.get("REDIS_PASSWORD"),
          db: configService.get<number>("REDIS_DB", 0),
          username: configService.get("REDIS_USERNAME"),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [QueueConfigService],
  exports: [BullModule, QueueConfigService],
})
export class QueueModule {}
