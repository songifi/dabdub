import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Merchant, MerchantStatus } from '../merchants/entities/merchant.entity';
import { Payment } from '../payments/entities/payment.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Merchant)
    private merchantsRepo: Repository<Merchant>,
    @InjectRepository(Payment)
    private paymentsRepo: Repository<Payment>,
  ) {}

  async findAllMerchants(page = 1, limit = 20) {
    const [merchants, total] = await this.merchantsRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { merchants: merchants.map(m => this.sanitize(m)), total };
  }

  async findOneMerchant(id: string) {
    const merchant = await this.merchantsRepo.findOne({ where: { id } });
    if (!merchant) throw new NotFoundException('Merchant not found');
    return this.sanitize(merchant);
  }

  async updateMerchantStatus(id: string, status: MerchantStatus) {
    const merchant = await this.merchantsRepo.findOne({ where: { id } });
    if (!merchant) throw new NotFoundException('Merchant not found');
    
    // Status transition logic if any (e.g., cannot go from SUSPENDED back to PENDING)
    merchant.status = status;
    await this.merchantsRepo.save(merchant);
    return this.sanitize(merchant);
  }

  async bulkUpdateMerchantStatus(ids: string[], status: MerchantStatus) {
    const results = {
      success: [] as string[],
      failed: [] as { id: string; error: string }[],
    };

    for (const id of ids) {
      try {
        await this.updateMerchantStatus(id, status);
        results.success.push(id);
      } catch (error) {
        results.failed.push({ id, error: error.message });
      }
    }

    return results;
  }

  async getGlobalStats() {
    const stats = await this.paymentsRepo
      .createQueryBuilder('payment')
      .select('payment.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(payment.amountUsd)', 'totalUsd')
      .groupBy('payment.status')
      .getRawMany();

    const merchantStats = await this.merchantsRepo
      .createQueryBuilder('merchant')
      .select('merchant.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('merchant.status')
      .getRawMany();

    return {
      payments: stats,
      merchants: merchantStats,
    };
  }

  private sanitize(merchant: Merchant) {
    const { passwordHash, apiKeyHash, ...rest } = merchant;
    return rest;
  }
}
