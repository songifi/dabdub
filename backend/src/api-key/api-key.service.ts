import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from './api-key.entity';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly repo: Repository<ApiKey>,
  ) {}

  async create(dto: any): Promise<{ apiKey: string; details: ApiKey }> {
    // Generate a secure 32-byte key with prefix
    const rawSecret = crypto.randomBytes(32).toString('base64url');
    const apiKey = `sk_stellar_${rawSecret}`;
    
    const salt = await bcrypt.genSalt(12);
    const keyHash = await bcrypt.hash(apiKey, salt);

    const newKey = this.repo.create({
      ...dto,
      keyHash,
      prefix: apiKey.substring(0, 11), // "sk_stellar_"
    });

    const saved = await this.repo.save(newKey);
    return { apiKey, details: saved };
  }

  async validateKey(rawKey: string): Promise<ApiKey | null> {
    const prefix = rawKey.substring(0, 11);
    const keysWithPrefix = await this.repo.find({ where: { prefix, isActive: true } });

    for (const keyEntity of keysWithPrefix) {
      const isMatch = await bcrypt.compare(rawKey, keyEntity.keyHash);
      if (isMatch) {
        await this.repo.update(keyEntity.id, { lastUsedAt: new Date() });
        return keyEntity;
      }
    }
    return null;
  }

  async revoke(id: string) {
    return this.repo.update(id, { isActive: false });
  }
}