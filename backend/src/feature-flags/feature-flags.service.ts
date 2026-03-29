import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import { redisConfig } from '../config/redis.config';
import { ConfigType } from '@nestjs/config';
import { TierName } from '../tier-config/entities/tier-config.entity';
import { User } from '../users/entities/user.entity';
import { CreateFeatureFlagDto } from './dto/create-feature-flag.dto';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import { FeatureFlag, FeatureFlagStatus } from './entities/feature-flag.entity';

@Injectable()
export class FeatureFlagsService {
  private readonly redis: Redis;

  constructor(
    @InjectRepository(FeatureFlag)
    private readonly featureFlagRepo: Repository<FeatureFlag>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @Inject(redisConfig.KEY)
    private readonly redisCfg: ConfigType<typeof redisConfig>,
  ) {
    this.redis = new Redis({
      host: this.redisCfg.host,
      port: this.redisCfg.port,
      password: this.redisCfg.password,
    });
  }

  async isEnabled(key: string, userId?: string, userTier?: string): Promise<boolean> {
    const cacheKey = `ff:${key}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached !== null) {
      return cached === 'true';
    }

    const flag = await this.featureFlagRepo.findOne({ where: { key } });
    if (!flag) {
      await this.redis.setex(cacheKey, 60, 'false');
      return false;
    }

    const result = await this.evaluateFlag(flag, userId, userTier);
    await this.redis.setex(cacheKey, 60, result.toString());
    return result;
  }

  async getEnabledFlags(userId: string, tier?: string): Promise<string[]> {
    const flags = await this.featureFlagRepo.find({
      where: { status: FeatureFlagStatus.ENABLED },
    });

    const enabledFlags: string[] = [];
    for (const flag of flags) {
      if (await this.evaluateFlag(flag, userId, tier)) {
        enabledFlags.push(flag.key);
      }
    }

    return enabledFlags;
  }

  async create(adminId: string, dto: CreateFeatureFlagDto): Promise<FeatureFlag> {
    const flag = this.featureFlagRepo.create({
      key: dto.key,
      description: dto.description,
      status: dto.status,
      percentage: dto.percentage ?? null,
      enabledTiers: dto.enabledTiers ?? null,
      enabledUserIds: dto.enabledUserIds ?? null,
      createdBy: adminId,
    });

    const saved = await this.featureFlagRepo.save(flag);
    await this.invalidateCache(saved.key);
    return saved;
  }

  async update(key: string, dto: UpdateFeatureFlagDto): Promise<FeatureFlag> {
    const flag = await this.featureFlagRepo.findOne({ where: { key } });
    if (!flag) {
      throw new Error('Feature flag not found');
    }

    Object.assign(flag, dto);
    const saved = await this.featureFlagRepo.save(flag);
    await this.invalidateCache(saved.key);
    return saved;
  }

  async listAll(): Promise<FeatureFlag[]> {
    return this.featureFlagRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  private async evaluateFlag(
    flag: FeatureFlag,
    userId?: string,
    userTier?: string,
  ): Promise<boolean> {
    switch (flag.status) {
      case FeatureFlagStatus.DISABLED:
        return false;
      
      case FeatureFlagStatus.ENABLED:
        return true;
      
      case FeatureFlagStatus.PERCENTAGE:
        if (!userId || flag.percentage === null) return false;
        return this.murmurHash(userId + flag.key) % 100 < flag.percentage;
      
      case FeatureFlagStatus.TIER:
        if (!userTier || !flag.enabledTiers) return false;
        return flag.enabledTiers.includes(userTier);
      
      case FeatureFlagStatus.USERS:
        if (!userId || !flag.enabledUserIds) return false;
        return flag.enabledUserIds.includes(userId);
      
      default:
        return false;
    }
  }

  private murmurHash(str: string): number {
    let hash = createHash('md5').update(str).digest('hex');
    return parseInt(hash.substring(0, 8), 16);
  }

  private async invalidateCache(key: string): Promise<void> {
    await this.redis.del(`ff:${key}`);
  }
}
