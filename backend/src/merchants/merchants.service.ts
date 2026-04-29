import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Merchant, MerchantStatus } from './entities/merchant.entity';
import { ApiScope, API_KEY_SCOPES } from '../auth/scopes';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { UpdateMerchantDto } from './dto/create-merchant.dto';
import { BulkMerchantActionDto, BulkActionResponseDto, BulkActionResultDto } from './dto/bulk-merchant-action.dto';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class MerchantsService {
  private readonly activeMerchantCountCacheKey = 'merchant:active:count';
  private readonly activeMerchantCountTtlSeconds = 300;

  constructor(
    @InjectRepository(Merchant)
    private merchantsRepo: Repository<Merchant>,
    @InjectRepository(AdminAuditLog)
    private auditRepo: Repository<AdminAuditLog>,
    private readonly cache: CacheService,
  ) {}

  async getActiveMerchantCount(): Promise<number> {
    const { value } = await this.cache.getOrSet<number>(
      this.activeMerchantCountCacheKey,
      () => this.merchantsRepo.count({ where: { status: MerchantStatus.ACTIVE } }),
      { ttlSeconds: this.activeMerchantCountTtlSeconds },
    );
    return value;
  }

  async findOne(id: string): Promise<Merchant> {
    const merchant = await this.merchantsRepo.findOne({ where: { id } });
    if (!merchant) throw new NotFoundException('Merchant not found');
    return merchant;
  }

  async update(id: string, dto: UpdateMerchantDto): Promise<Merchant> {
    const merchant = await this.findOne(id);
    Object.assign(merchant, dto);
    const updated = await this.merchantsRepo.save(merchant);
    await this.cache.del(this.activeMerchantCountCacheKey);
    return updated;
  }

  async bulkUpdateStatus(
    adminId: string,
    dto: BulkMerchantActionDto,
    status: MerchantStatus,
  ): Promise<BulkActionResponseDto> {
    const results: BulkActionResultDto[] = [];
    let successful = 0;
    let failed = 0;

    for (const id of dto.ids) {
      try {
        const merchant = await this.merchantsRepo.findOne({ where: { id } });
        if (!merchant) {
          throw new Error('Merchant not found');
        }

        const oldStatus = merchant.status;
        merchant.status = status;
        await this.merchantsRepo.save(merchant);
        await this.cache.del(this.activeMerchantCountCacheKey);

        await this.auditRepo.save({
          adminId,
          action: `merchant_${status}`,
          targetId: id,
          details: {
            oldStatus,
            newStatus: status,
          },
        });

        results.push({ id, success: true });
        successful++;
      } catch (error) {
        results.push({ id, success: false, error: error.message });
        failed++;
      }
    }

    return {
      results,
      total: dto.ids.length,
      successful,
      failed,
    };
  }

  async generateApiKey(id: string, scopes?: ApiScope[]): Promise<{ apiKey: string }> {
    const merchant = await this.findOne(id);
    const rawKey = `cpk_${crypto.randomBytes(32).toString('hex')}`;
    const hash = await bcrypt.hash(rawKey, 10);

    merchant.apiKey = rawKey.substring(0, 12) + '...';
    merchant.apiKeyHash = hash;
    merchant.apiKeyScopes = scopes?.length ? scopes : API_KEY_SCOPES;
    await this.merchantsRepo.save(merchant);

    return { apiKey: rawKey };
  }

  async getProfile(id: string) {
    return this.findOne(id);
  }

  async updateMerchantFee(
    merchantId: string,
    customFeeRate: number | null,
  ): Promise<Merchant> {
    const merchant = await this.merchantsRepo.findOne({ where: { id: merchantId } });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    merchant.customFeeRate = customFeeRate != null ? String(customFeeRate) : null;
    const updated = await this.merchantsRepo.save(merchant);
    await this.cache.del(this.activeMerchantCountCacheKey);
    return updated;
  }
}
