import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKeyUsage } from './entities/api-key-usage.entity';
import { ApiKey } from './entities/api-key.entity';

@Injectable()
export class ApiKeyUsageService {
  constructor(
    @InjectRepository(ApiKeyUsage) private usageRepo: Repository<ApiKeyUsage>,
    @InjectRepository(ApiKey) private apiKeyRepo: Repository<ApiKey>,
  ) {}

  async getStatistics(apiKeyId: string, merchantId: string): Promise<{ keyId: string; lastUsedAt: Date | null }> {
    const key = await this.apiKeyRepo.findOne({
      where: { id: apiKeyId, merchantId },
    });
    if (!key) return { keyId: apiKeyId, lastUsedAt: null };
    return { keyId: apiKeyId, lastUsedAt: key.lastUsedAt ?? null };
  }
}
