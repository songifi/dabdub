import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MerchantIpAllowlist } from '../entities/merchant-ip-allowlist.entity';
import { Merchant } from '../../database/entities/merchant.entity';
import { AddIpAllowlistDto } from '../dto/security.dto';
import { RedisService } from '../../common/redis/redis.service';
import { RedisKeys } from '../../common/redis/redis-keys';
import { IpUtils } from '../utils/ip.utils';

@Injectable()
export class IpAllowlistService {
  private readonly logger = new Logger(IpAllowlistService.name);

  constructor(
    @InjectRepository(MerchantIpAllowlist)
    private readonly allowlistRepository: Repository<MerchantIpAllowlist>,
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
    private readonly redisService: RedisService,
  ) {}

  async getAllowlist(merchantId: string): Promise<MerchantIpAllowlist[]> {
    return this.allowlistRepository.find({
      where: { merchantId, isActive: true },
    });
  }

  async addIp(merchantId: string, dto: AddIpAllowlistDto, adminId: string): Promise<{ data: MerchantIpAllowlist; warning?: string }> {
    const existing = await this.getAllowlist(merchantId);
    let warning: string | undefined;

    if (existing.length === 0) {
      warning = 'This is the first entry. Enabling allowlist enforcement will reject all other IPs.';
    }

    const entry = this.allowlistRepository.create({
      merchantId,
      cidr: dto.cidr,
      label: dto.label,
      createdById: adminId,
      isActive: true,
    });

    const saved = await this.allowlistRepository.save(entry);
    await this.syncToRedis(merchantId);

    return { data: saved, warning };
  }

  async removeIp(merchantId: string, id: string, adminId: string): Promise<void> {
    const entry = await this.allowlistRepository.findOne({ where: { id, merchantId } });
    if (!entry) throw new BadRequestException('IP entry not found');

    entry.isActive = false;
    entry.removedById = adminId;
    await this.allowlistRepository.save(entry);
    await this.syncToRedis(merchantId);
  }

  async toggleEnforcement(merchantId: string, enabled: boolean): Promise<Merchant> {
    const merchant = await this.merchantRepository.findOne({ where: { id: merchantId } });
    if (!merchant) throw new BadRequestException('Merchant not found');

    merchant.ipAllowlistEnforced = enabled;
    const updated = await this.merchantRepository.save(merchant);
    
    // Sync enforcement state to Redis if needed, or just let the gateway check DB/Cache
    await this.redisService.client.set(
      `security:merchant_enforcement:${merchantId}`,
      enabled ? 'true' : 'false',
    );

    return updated;
  }

  async isIpAllowed(merchantId: string, ip: string): Promise<boolean> {
    const isEnforced = await this.redisService.client.get(`security:merchant_enforcement:${merchantId}`);
    if (isEnforced !== 'true') return true;

    const cidrs = await this.redisService.client.smembers(RedisKeys.merchantIpAllowlist(merchantId));
    if (cidrs.length === 0) return true; // If enforced but empty, maybe fail safe? Prompt says "reject all other IPs"

    for (const cidr of cidrs) {
      if (IpUtils.isIpInCidr(ip, cidr)) {
        return true;
      }
    }
    return false;
  }

  async syncToRedis(merchantId: string): Promise<void> {
    const activeEntries = await this.allowlistRepository.find({
      where: { merchantId, isActive: true },
    });

    await this.redisService.client.del(RedisKeys.merchantIpAllowlist(merchantId));
    if (activeEntries.length > 0) {
      const cidrs = activeEntries.map(e => e.cidr);
      await this.redisService.client.sadd(RedisKeys.merchantIpAllowlist(merchantId), ...cidrs);
    }
  }
}
