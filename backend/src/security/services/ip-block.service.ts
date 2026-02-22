import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, IsNull, Or } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { IpBlock } from '../entities/ip-block.entity';
import { BlockIpDto } from '../dto/security.dto';
import { RedisService } from '../../common/redis/redis.service';
import { RedisKeys } from '../../common/redis/redis-keys';
import { IpUtils } from '../utils/ip.utils';

@Injectable()
export class IpBlockService implements OnModuleInit {
  private readonly logger = new Logger(IpBlockService.name);

  constructor(
    @InjectRepository(IpBlock)
    private readonly ipBlockRepository: Repository<IpBlock>,
    private readonly redisService: RedisService,
    @InjectQueue('ip-expiry')
    private readonly ipExpiryQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.syncToRedis();
  }

  async blockIp(dto: BlockIpDto, adminId: string): Promise<IpBlock> {
    const ipBlock = this.ipBlockRepository.create({
      cidr: dto.cidr,
      reason: dto.reason,
      note: dto.note,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      createdById: adminId,
      isActive: true,
    });

    const saved = await this.ipBlockRepository.save(ipBlock);
    await this.syncIpToRedis(saved);

    if (saved.expiresAt) {
      const delay = saved.expiresAt.getTime() - Date.now();
      if (delay > 0) {
        await this.ipExpiryQueue.add(
          'expire-ip',
          { id: saved.id },
          { delay, jobId: `expire-ip:${saved.id}` },
        );
      } else {
        await this.unblockIp(saved.id, 'system');
      }
    }

    return saved;
  }

  async unblockIp(id: string, adminId: string): Promise<void> {
    const ipBlock = await this.ipBlockRepository.findOne({ where: { id } });
    if (!ipBlock) return;

    ipBlock.isActive = false;
    // Audit log can be handled here or in controller
    await this.ipBlockRepository.save(ipBlock);
    await this.redisService.client.srem(RedisKeys.ipBlocks(), ipBlock.cidr);
    await this.redisService.client.del(RedisKeys.ipBlock(ipBlock.cidr));
    
    // Remove from queue if exists (optional, BullMQ handling might be better)
    const job = await this.ipExpiryQueue.getJob(`expire-ip:${id}`);
    if (job) await job.remove();
  }

  async listBlockedIps(): Promise<IpBlock[]> {
    return this.ipBlockRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async isIpBlocked(ip: string): Promise<boolean> {
    // Check Redis first for direct performance
    const cidrs = await this.redisService.client.smembers(RedisKeys.ipBlocks());
    for (const cidr of cidrs) {
      if (IpUtils.isIpInCidr(ip, cidr)) {
        return true;
      }
    }
    return false;
  }

  async syncToRedis(): Promise<void> {
    this.logger.log('Syncing IP blocks to Redis...');
    const activeBlocks = await this.ipBlockRepository.find({
      where: [
        { isActive: true, expiresAt: IsNull() },
        { isActive: true, expiresAt: Or(IsNull(), LessThanOrEqual(new Date())) }, // This is not quite right for future expiry
      ],
    });
    
    // Correct filter for active blocks (not expired)
    const now = new Date();
    const currentBlocks = await this.ipBlockRepository.createQueryBuilder('block')
      .where('block.isActive = :isActive', { isActive: true })
      .andWhere('(block.expiresAt IS NULL OR block.expiresAt > :now)', { now })
      .getMany();

    await this.redisService.client.del(RedisKeys.ipBlocks());
    if (currentBlocks.length > 0) {
      const cidrs = currentBlocks.map(b => b.cidr);
      await this.redisService.client.sadd(RedisKeys.ipBlocks(), ...cidrs);
      for (const block of currentBlocks) {
        await this.redisService.client.set(
          RedisKeys.ipBlock(block.cidr),
          JSON.stringify(block),
        );
      }
    }
    this.logger.log(`Synced ${currentBlocks.length} IP blocks to Redis`);
  }

  private async syncIpToRedis(block: IpBlock): Promise<void> {
    await this.redisService.client.sadd(RedisKeys.ipBlocks(), block.cidr);
    await this.redisService.client.set(
      RedisKeys.ipBlock(block.cidr),
      JSON.stringify(block),
    );
  }
}
