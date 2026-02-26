import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from './entities/api-key.entity';
import * as crypto from 'crypto';

const KEY_PREFIX = 'sk_live_';
const PREFIX_LEN = 8; // "sk_live_".length

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly repo: Repository<ApiKey>,
  ) {}

  async create(
    merchantId: string,
    dto: { name: string; scopes?: string[]; ipWhitelist?: string[] },
  ): Promise<{ apiKey: string; id: string; name: string; scopes: string[] }> {
    const rawSecret = crypto.randomBytes(32).toString('base64url');
    const apiKey = `${KEY_PREFIX}${rawSecret}`;
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const scopes = dto.scopes ?? ['payments:read'];
    const newKey = this.repo.create({
      name: dto.name,
      keyHash,
      prefix: apiKey.substring(0, PREFIX_LEN),
      scopes,
      ipWhitelist: dto.ipWhitelist ?? [],
      merchantId,
    });

    const saved = await this.repo.save(newKey);
    return {
      apiKey,
      id: saved.id,
      name: saved.name,
      scopes: saved.scopes,
    };
  }

  async validateKey(rawKey: string): Promise<ApiKey | null> {
    if (!rawKey || !rawKey.startsWith(KEY_PREFIX)) return null;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyEntity = await this.repo.findOne({
      where: { keyHash, isActive: true },
      relations: ['merchant'],
    });
    if (!keyEntity) return null;
    await this.repo.update(keyEntity.id, { lastUsedAt: new Date() });
    return keyEntity;
  }

  async findAllByMerchant(merchantId: string): Promise<MaskedApiKeyDto[]> {
    const keys = await this.repo.find({
      where: { merchantId },
      order: { createdAt: 'DESC' },
    });
    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      scopes: k.scopes,
      lastUsedAt: k.lastUsedAt ?? null,
      createdAt: k.createdAt,
      isActive: k.isActive,
    }));
  }

  async findOne(id: string, merchantId: string): Promise<MaskedApiKeyDto> {
    const key = await this.repo.findOne({
      where: { id, merchantId },
    });
    if (!key) throw new NotFoundException('API key not found');
    return {
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      scopes: key.scopes,
      lastUsedAt: key.lastUsedAt ?? null,
      createdAt: key.createdAt,
      isActive: key.isActive,
    };
  }

  async updateScopes(id: string, merchantId: string, scopes: string[]): Promise<MaskedApiKeyDto> {
    const key = await this.repo.findOne({ where: { id, merchantId } });
    if (!key) throw new NotFoundException('API key not found');
    key.scopes = scopes;
    await this.repo.save(key);
    return this.findOne(id, merchantId);
  }

  async rotate(id: string, merchantId: string): Promise<{ apiKey: string; id: string; name: string; scopes: string[] }> {
    const existing = await this.repo.findOne({ where: { id, merchantId } });
    if (!existing) throw new NotFoundException('API key not found');
    await this.repo.update(id, { isActive: false });
    return this.create(merchantId, {
      name: existing.name,
      scopes: existing.scopes,
      ipWhitelist: existing.ipWhitelist,
    });
  }

  async revoke(id: string, merchantId: string): Promise<void> {
    const key = await this.repo.findOne({ where: { id, merchantId } });
    if (!key) throw new NotFoundException('API key not found');
    await this.repo.update(id, { isActive: false });
  }

  async updateIpWhitelist(id: string, merchantId: string, ips: string[]): Promise<void> {
    const key = await this.repo.findOne({ where: { id, merchantId } });
    if (!key) throw new NotFoundException('API key not found');
    key.ipWhitelist = ips;
    await this.repo.save(key);
  }
}

export interface MaskedApiKeyDto {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: Date | null;
  createdAt: Date;
  isActive: boolean;
}
