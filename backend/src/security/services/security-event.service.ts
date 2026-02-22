import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { SecurityEvent } from '../entities/security-event.entity';
import { SecurityEventType, BlockReason } from '../enums';
import { IpBlockService } from './ip-block.service';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class SecurityEventService {
  private readonly logger = new Logger(SecurityEventService.name);

  constructor(
    @InjectRepository(SecurityEvent)
    private readonly eventRepository: Repository<SecurityEvent>,
    private readonly ipBlockService: IpBlockService,
    private readonly redisService: RedisService,
  ) {}

  async logEvent(data: Partial<SecurityEvent>): Promise<SecurityEvent> {
    const event = this.eventRepository.create(data);
    const saved = await this.eventRepository.save(event);

    if (event.type === SecurityEventType.API_KEY_BRUTE_FORCE) {
      await this.checkAutoBlockBruteForce(event.ipAddress);
    }

    return saved;
  }

  async getEvents(query: {
    type?: SecurityEventType;
    merchantId?: string;
    ipAddress?: string;
    wasBlocked?: boolean;
    createdAfter?: string;
    createdBefore?: string;
    page?: number;
    limit?: number;
  }) {
    const { type, merchantId, ipAddress, wasBlocked, createdAfter, createdBefore, page = 1, limit = 20 } = query;
    const where: any = {};

    if (type) where.type = type;
    if (merchantId) where.merchantId = merchantId;
    if (ipAddress) where.ipAddress = ipAddress;
    if (wasBlocked !== undefined) where.wasBlocked = wasBlocked;

    if (createdAfter || createdBefore) {
      const after = createdAfter ? new Date(createdAfter) : new Date(0);
      const before = createdBefore ? new Date(createdBefore) : new Date();
      where.createdAt = Between(after, before);
    }

    const [items, total] = await this.eventRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }

  async getSummary() {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const events = await this.eventRepository.find({
      where: { createdAt: Between(last24h, new Date()) },
    });

    const totalEvents = events.length;
    const blockedRequests = events.filter(e => e.wasBlocked).length;
    const uniqueSuspiciousIps = new Set(events.map(e => e.ipAddress)).size;
    
    const byType: Record<string, number> = {};
    for (const type of Object.values(SecurityEventType)) {
      byType[type] = events.filter(e => e.type === type).length;
    }

    // Top offending IPs (excluding already blocked)
    const ipCounts: Record<string, number> = {};
    for (const e of events) {
      ipCounts[e.ipAddress] = (ipCounts[e.ipAddress] || 0) + 1;
    }

    const topOffendingIpsRaw = Object.entries(ipCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topOffendingIps = [];
    for (const [ip, count] of topOffendingIpsRaw) {
      const isBlocked = await this.ipBlockService.isIpBlocked(ip);
      if (!isBlocked) {
        topOffendingIps.push({ ip, eventCount: count, isBlocked });
      }
    }

    return {
      last24h: {
        totalEvents,
        blockedRequests,
        uniqueSuspiciousIps,
        byType,
      },
      topOffendingIps,
    };
  }

  private async checkAutoBlockBruteForce(ip: string) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const count = await this.eventRepository.count({
      where: {
        ipAddress: ip,
        type: SecurityEventType.API_KEY_BRUTE_FORCE,
        createdAt: Between(oneHourAgo, new Date()),
      },
    });

    if (count >= 10) {
      const alreadyBlocked = await this.ipBlockService.isIpBlocked(ip);
      if (!alreadyBlocked) {
        this.logger.warn(`Auto-blocking IP ${ip} due to ${count} brute force attempts`);
        await this.ipBlockService.blockIp({
          cidr: `${ip}/32`,
          reason: BlockReason.AUTO_BRUTE_FORCE,
          note: `Auto-blocked after ${count} API_KEY_BRUTE_FORCE events in 1 hour`,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h temporary block
        }, 'system');
      }
    }
  }
}
