import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheService } from '../cache/cache.service';
import { TierName } from '../tier-config/entities/tier-config.entity';
import {
  FeatureFlag,
  FeatureFlagStatus,
} from './entities/feature-flag.entity';
import { CreateFeatureFlagDto } from './dto/create-feature-flag.dto';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import {
  murmurBucketPercent,
  tierRolloutMatches,
} from './feature-flag.util';

const CACHE_PREFIX = 'ff:';
const CACHE_TTL_SECONDS = 60;

export type CachedFeatureFlag = Pick<
  FeatureFlag,
  | 'id'
  | 'key'
  | 'status'
  | 'percentage'
  | 'enabledTiers'
  | 'enabledUserIds'
>;

@Injectable()
export class FeatureFlagService {
  constructor(
    @InjectRepository(FeatureFlag)
    private readonly repo: Repository<FeatureFlag>,
    private readonly cache: CacheService,
  ) {}

  cacheKeyForFlag(key: string): string {
    return `${CACHE_PREFIX}${key}`;
  }

  private toCached(row: FeatureFlag): CachedFeatureFlag {
    return {
      id: row.id,
      key: row.key,
      status: row.status,
      percentage: row.percentage,
      enabledTiers: row.enabledTiers,
      enabledUserIds: row.enabledUserIds,
    };
  }

  async getFlagRowCached(key: string): Promise<CachedFeatureFlag | null> {
    const ck = this.cacheKeyForFlag(key);
    const hit = await this.cache.get<CachedFeatureFlag>(ck);
    if (hit) return hit;

    const row = await this.repo.findOne({ where: { key } });
    if (!row) return null;

    const slim = this.toCached(row);
    await this.cache.set(ck, slim, CACHE_TTL_SECONDS);
    return slim;
  }

  async invalidateFlagCache(key: string): Promise<void> {
    await this.cache.del(this.cacheKeyForFlag(key));
  }

  evaluateFlag(
    flag: CachedFeatureFlag,
    userId?: string,
    userTier?: TierName,
  ): boolean {
    switch (flag.status) {
      case FeatureFlagStatus.DISABLED:
        return false;
      case FeatureFlagStatus.ENABLED:
        return true;
      case FeatureFlagStatus.PERCENTAGE: {
        if (!userId || flag.percentage == null) return false;
        const p = flag.percentage;
        if (p <= 0) return false;
        if (p >= 100) return true;
        return murmurBucketPercent(userId, flag.key) < p;
      }
      case FeatureFlagStatus.TIER: {
        if (!userTier) return false;
        return tierRolloutMatches(flag.enabledTiers, userTier);
      }
      case FeatureFlagStatus.USERS: {
        if (!userId || !flag.enabledUserIds?.length) return false;
        return flag.enabledUserIds.includes(userId);
      }
      default:
        return false;
    }
  }

  async isEnabled(
    key: string,
    userId?: string,
    userTier?: TierName,
  ): Promise<boolean> {
    const row = await this.getFlagRowCached(key);
    if (!row) return false;
    return this.evaluateFlag(row, userId, userTier);
  }

  async getEnabledFlags(userId: string, tier: TierName): Promise<string[]> {
    const flags = await this.repo.find();
    const keys: string[] = [];
    for (const f of flags) {
      const row = (await this.getFlagRowCached(f.key)) ?? this.toCached(f);
      if (this.evaluateFlag(row, userId, tier)) {
        keys.push(f.key);
      }
    }
    return keys;
  }

  async listAll(): Promise<FeatureFlag[]> {
    return this.repo.find({ order: { key: 'ASC' } });
  }

  private validateDtoShape(
    status: FeatureFlagStatus,
    dto: Pick<
      CreateFeatureFlagDto | UpdateFeatureFlagDto,
      'percentage' | 'enabledTiers' | 'enabledUserIds'
    >,
  ): void {
    if (status === FeatureFlagStatus.PERCENTAGE) {
      if (dto.percentage == null || dto.percentage < 0 || dto.percentage > 100) {
        throw new BadRequestException(
          'percentage is required and must be 0–100 for status=percentage',
        );
      }
    }
    if (status === FeatureFlagStatus.TIER) {
      if (!dto.enabledTiers?.length) {
        throw new BadRequestException(
          'enabledTiers is required for status=tier',
        );
      }
    }
    if (status === FeatureFlagStatus.USERS) {
      if (!dto.enabledUserIds?.length) {
        throw new BadRequestException(
          'enabledUserIds is required for status=users',
        );
      }
    }
  }

  async create(adminId: string, dto: CreateFeatureFlagDto): Promise<FeatureFlag> {
    const existing = await this.repo.findOne({ where: { key: dto.key } });
    if (existing) {
      throw new BadRequestException(`Flag "${dto.key}" already exists`);
    }
    this.validateDtoShape(dto.status, dto);

    const row = this.repo.create({
      key: dto.key,
      description: dto.description,
      status: dto.status,
      percentage: dto.percentage ?? null,
      enabledTiers: dto.enabledTiers ?? null,
      enabledUserIds: dto.enabledUserIds ?? null,
      createdBy: adminId,
    });
    const saved = await this.repo.save(row);
    await this.invalidateFlagCache(saved.key);
    await this.getFlagRowCached(saved.key);
    return saved;
  }

  async updateByKey(
    key: string,
    dto: UpdateFeatureFlagDto,
  ): Promise<FeatureFlag> {
    const row = await this.repo.findOne({ where: { key } });
    if (!row) throw new NotFoundException('Feature flag not found');

    const nextStatus = dto.status ?? row.status;
    const merged = {
      percentage:
        dto.percentage !== undefined ? dto.percentage : row.percentage,
      enabledTiers:
        dto.enabledTiers !== undefined ? dto.enabledTiers : row.enabledTiers,
      enabledUserIds:
        dto.enabledUserIds !== undefined
          ? dto.enabledUserIds
          : row.enabledUserIds,
    };
    this.validateDtoShape(nextStatus, merged);

    if (dto.description !== undefined) row.description = dto.description;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.percentage !== undefined) row.percentage = dto.percentage;
    if (dto.enabledTiers !== undefined) row.enabledTiers = dto.enabledTiers;
    if (dto.enabledUserIds !== undefined) {
      row.enabledUserIds = dto.enabledUserIds;
    }

    const saved = await this.repo.save(row);
    await this.invalidateFlagCache(key);
    await this.getFlagRowCached(key);
    return saved;
  }
}
