import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/**
 * Pings the Better Uptime heartbeat URL every 5 minutes.
 *
 * If this service stops pinging (process crash, OOM, etc.), Better Uptime
 * will open an incident after the configured grace period (recommend: 2 min).
 *
 * Configure via env:
 *   BETTER_UPTIME_HEARTBEAT_URL=https://betteruptime.com/api/v1/heartbeat/xxxxx
 */
@Injectable()
export class UptimeHeartbeatService {
  private readonly logger = new Logger(UptimeHeartbeatService.name);

  constructor(private readonly config: ConfigService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async ping(): Promise<void> {
    const url = this.config.get<string>('BETTER_UPTIME_HEARTBEAT_URL');
    if (!url) return;

    try {
      await axios.get(url, { timeout: 5_000 });
      this.logger.debug('Heartbeat ping sent');
    } catch (err) {
      // Log but don't throw — a failed ping is not fatal to the app
      this.logger.warn(
        `Heartbeat ping failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
