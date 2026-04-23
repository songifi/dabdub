import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class QueueConfigService {
  constructor(private configService: ConfigService) {}

  get redisHost() {
    return this.configService.get<string>("REDIS_HOST", "127.0.0.1");
  }

  get redisPort() {
    return Number(this.configService.get<number>("REDIS_PORT", 6379));
  }

  get redisPassword() {
    return this.configService.get<string>("REDIS_PASSWORD");
  }

  get redisDb() {
    return Number(this.configService.get<number>("REDIS_DB", 0));
  }

  get queueMaxRetries() {
    return Number(this.configService.get<number>("QUEUE_MAX_RETRIES", 5));
  }

  get webhookRetrySchedule(): number[] {
    return this.parseCsvToMillis(
      this.configService.get<string>(
        "WEBHOOK_RETRY_SCHEDULE",
        "60000,300000,1800000,7200000,43200000",
      ),
    );
  }

  get emailRetryDelay(): number {
    return Number(this.configService.get<number>("EMAIL_RETRY_DELAY", 300000));
  }

  get emailMaxRetries(): number {
    return Number(this.configService.get<number>("EMAIL_MAX_RETRIES", 1));
  }

  get settlementRetryDelays(): number[] {
    return this.parseCsvToMillis(
      this.configService.get<string>(
        "SETTLEMENT_RETRY_DELAYS",
        "60000,300000,1800000",
      ),
    );
  }

  get stellarMonitorRetryDelay(): number {
    return Number(
      this.configService.get<number>("STELLAR_MONITOR_RETRY_DELAY", 0),
    );
  }

  private parseCsvToMillis(value: string): number[] {
    return value
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((ms) => !Number.isNaN(ms) && ms >= 0);
  }
}
