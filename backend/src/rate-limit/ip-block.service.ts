import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

const THROTTLE_HIT_PREFIX = 'ip:throttle_hits:';
const BLOCKED_PREFIX = 'ip:blocked:';
const BLOCK_THRESHOLD = 5; // consecutive 429s before block
const BLOCK_WINDOW_SECONDS = 3600; // 1 hour

@Injectable()
export class IpBlockService {
  private readonly logger = new Logger(IpBlockService.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Increments the 429 hit counter for the IP within the 1h window.
   * If the count reaches the threshold, blocks the IP for 1 hour.
   */
  async recordThrottleHit(ip: string): Promise<void> {
    const hitKey = `${THROTTLE_HIT_PREFIX}${ip}`;

    const count = await this.redis.incr(hitKey);

    if (count === 1) {
      // Set expiry on first hit so the window auto-resets after 1 hour
      await this.redis.expire(hitKey, BLOCK_WINDOW_SECONDS);
    }

    if (count >= BLOCK_THRESHOLD) {
      await this.blockIp(ip);
      this.logger.warn(`IP ${ip} blocked after ${count} throttle violations`);
    }
  }

  async blockIp(ip: string): Promise<void> {
    const blockedKey = `${BLOCKED_PREFIX}${ip}`;
    await this.redis.set(blockedKey, '1', 'EX', BLOCK_WINDOW_SECONDS);
  }

  async isBlocked(ip: string): Promise<boolean> {
    const blockedKey = `${BLOCKED_PREFIX}${ip}`;
    const val = await this.redis.get(blockedKey);
    return val !== null;
  }

  async unblockIp(ip: string): Promise<void> {
    const blockedKey = `${BLOCKED_PREFIX}${ip}`;
    const hitKey = `${THROTTLE_HIT_PREFIX}${ip}`;
    await this.redis.del(blockedKey, hitKey);
  }

  /**
   * SCAN-based listing of all currently blocked IPs.
   * Returns the IP addresses without the key prefix.
   */
  async listBlockedIps(): Promise<string[]> {
    const pattern = `${BLOCKED_PREFIX}*`;
    const ips: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      for (const key of keys) {
        ips.push(key.replace(BLOCKED_PREFIX, ''));
      }
    } while (cursor !== '0');

    return ips;
  }
}
