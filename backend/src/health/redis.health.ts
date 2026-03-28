import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import Redis from 'ioredis';
import { redisConfig } from '../config';
import type { RedisConfig } from '../config';

/**
 * RedisHealthIndicator pings Redis using ioredis and reports the result
 * in the standard Terminus HealthIndicatorResult shape.
 *
 * A dedicated short-lived client is created per module bootstrap so the
 * health module never competes with the application's Bull/cache connections.
 */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);
  private readonly client: Redis;

  constructor(
    @Inject(redisConfig.KEY)
    private readonly cfg: RedisConfig,
  ) {
    super();
    this.client = new Redis({
      host: cfg.host,
      port: cfg.port,
      password: cfg.password,
      // Fail fast — don't block the health route for more than 2 s.
      connectTimeout: 2_000,
      commandTimeout: 2_000,
      // Never auto-reconnect inside the health client; reconnect attempts
      // would accumulate silently and mask real outages.
      maxRetriesPerRequest: 0,
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    // Suppress unhandled error events; errors surface through pingCheck().
    this.client.on('error', (err: Error) => {
      this.logger.warn(`Redis health client error: ${err.message}`);
    });
  }

  /**
   * Execute PING and return an HealthIndicatorResult.
   * Throws HealthCheckError (which Terminus catches) on failure.
   */
  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    try {
      // Connect lazily; if already connected this is a no-op.
      if (this.client.status === 'wait' || this.client.status === 'close') {
        await this.client.connect();
      }

      const reply = await this.client.ping();

      if (reply !== 'PONG') {
        throw new Error(`Unexpected PING reply: ${reply}`);
      }

      return this.getStatus(key, true);
    } catch (err) {
      const result = this.getStatus(key, false, {
        message: err instanceof Error ? err.message : String(err),
      });
      throw new HealthCheckError(`${key} is down`, result);
    }
  }
}
