import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RuntimeConfig } from './entities/runtime-config.entity';
import { CacheService } from '../cache/cache.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class RuntimeConfigService {
  private readonly CACHE_PREFIX = 'config:';
  private readonly CACHE_TTL = 60; // 60 seconds

  constructor(
    @InjectRepository(RuntimeConfig)
    private readonly configRepo: Repository<RuntimeConfig>,
    private readonly cacheService: CacheService,
    private readonly auditService: AuditService,
  ) {}

  async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    const cacheKey = `${this.CACHE_PREFIX}${key}`;
    
    // 1. Try Redis
    const cached = await this.cacheService.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // 2. Try DB
    const config = await this.configRepo.findOne({ where: { key } });
    if (config) {
      const value = config.value as T;
      // Cache for 60s
      await this.cacheService.set(cacheKey, value, this.CACHE_TTL);
      return value;
    }

    // 3. Not in DB, return default
    return defaultValue;
  }

  async set(key: string, value: any, adminId: string, description?: string): Promise<RuntimeConfig> {
    try {
      JSON.stringify(value);
    } catch {
      throw new BadRequestException('Invalid JSON value');
    }

    const cacheKey = `${this.CACHE_PREFIX}${key}`;

    let config = await this.configRepo.findOne({ where: { key } });
    if (config) {
      config.value = value;
      config.updatedBy = adminId;
      if (description) config.description = description;
    } else {
      config = this.configRepo.create({
        key,
        value,
        updatedBy: adminId,
        description,
      });
    }

    const saved = await this.configRepo.save(config);
    await this.cacheService.del(cacheKey);
    await this.auditService.log(adminId, 'config.set', { key, value });

    return saved;
  }

  async getAll(): Promise<RuntimeConfig[]> {
    return this.configRepo.find({ order: { key: 'ASC' } });
  }
}
