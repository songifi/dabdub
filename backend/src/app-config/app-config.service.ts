import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfig } from './entities/app-config.entity';
import { CacheService } from '../cache/cache.service';
import { AuditService } from '../audit/audit.service';

const CACHE_PREFIX = 'config:';
const CACHE_TTL = 60;

@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);

  constructor(
    @InjectRepository(AppConfig)
    private readonly repo: Repository<AppConfig>,
    private readonly cache: CacheService,
    private readonly auditService: AuditService,
  ) {}

  async get<T = unknown>(key: string, defaultValue?: T): Promise<T> {
    const cached = await this.cache.get<T>(`${CACHE_PREFIX}${key}`);
    if (cached !== null) return cached;

    const record = await this.repo.findOne({ where: { key } });
    if (!record) return defaultValue as T;

    await this.cache.set(`${CACHE_PREFIX}${key}`, record.value, CACHE_TTL);
    return record.value as T;
  }

  async set(key: string, value: unknown, updatedBy?: string): Promise<AppConfig> {
    try {
      JSON.parse(JSON.stringify(value));
    } catch {
      throw new BadRequestException('Value must be valid JSON');
    }

    await this.repo.upsert(
      { key, value, updatedBy: updatedBy ?? null },
      { conflictPaths: ['key'], skipUpdateIfNoValuesChanged: false },
    );

    await this.cache.del(`${CACHE_PREFIX}${key}`);

    if (updatedBy) {
      await this.auditService.log(updatedBy, 'config.set', JSON.stringify({ key, value }));
    }

    this.logger.log(`AppConfig updated: key=${key} by=${updatedBy ?? 'system'}`);

    return this.repo.findOneOrFail({ where: { key } });
  }

  async getAll(): Promise<AppConfig[]> {
    return this.repo.find({ order: { key: 'ASC' } });
  }
}
