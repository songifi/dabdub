import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, FindManyOptions, In } from 'typeorm';
import { Settlement, SettlementStatus } from '../entities/settlement.entity';

@Injectable()
export class SettlementRepository {
  constructor(
    @InjectRepository(Settlement)
    private readonly repository: Repository<Settlement>,
  ) {}

  async create(settlementData: Partial<Settlement>): Promise<Settlement> {
    const settlement = this.repository.create(settlementData);
    return this.repository.save(settlement);
  }

  async findOne(id: string): Promise<Settlement | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByPaymentRequestId(
    paymentRequestId: string,
  ): Promise<Settlement | null> {
    return this.repository.findOne({
      where: { paymentRequestId },
    });
  }

  async findByMerchantId(
    merchantId: string,
    options?: FindManyOptions<Settlement>,
  ): Promise<Settlement[]> {
    return this.repository.find({
      where: { merchantId },
      ...options,
    });
  }

  async findByStatus(
    status: SettlementStatus,
    options?: FindManyOptions<Settlement>,
  ): Promise<Settlement[]> {
    return this.repository.find({
      where: { status },
      ...options,
    });
  }

  async findByBatchId(batchId: string): Promise<Settlement[]> {
    return this.repository.find({
      where: { batchId },
      order: { batchSequence: 'ASC' },
    });
  }

  async findPendingSettlements(limit?: number): Promise<Settlement[]> {
    const query = this.repository
      .createQueryBuilder('settlement')
      .where('settlement.status = :status', {
        status: SettlementStatus.PENDING,
      })
      .andWhere('settlement.retryCount < settlement.maxRetries')
      .orderBy('settlement.createdAt', 'ASC');

    if (limit) {
      query.limit(limit);
    }

    return query.getMany();
  }

  async findRetryableSettlements(limit?: number): Promise<Settlement[]> {
    const query = this.repository
      .createQueryBuilder('settlement')
      .where('settlement.status = :status', { status: SettlementStatus.FAILED })
      .andWhere('settlement.retryCount < settlement.maxRetries')
      .orderBy('settlement.updatedAt', 'ASC');

    if (limit) {
      query.limit(limit);
    }

    return query.getMany();
  }

  async updateStatus(
    id: string,
    status: SettlementStatus,
    additionalData?: Partial<Settlement>,
  ): Promise<Settlement> {
    const updateData: Partial<Settlement> = {
      status,
      ...additionalData,
    };

    if (status === SettlementStatus.COMPLETED && !updateData.settledAt) {
      updateData.settledAt = new Date();
    }

    if (status === SettlementStatus.PROCESSING && !updateData.processedAt) {
      updateData.processedAt = new Date();
    }

    await this.repository.update(id, updateData);
    const updatedSettlement = await this.findOne(id);
    if (!updatedSettlement) {
      throw new Error(`Settlement with id ${id} not found`);
    }
    return updatedSettlement;
  }

  async incrementRetryCount(id: string): Promise<Settlement> {
    const settlement = await this.findOne(id);
    if (settlement) {
      settlement.retryCount += 1;
      return this.repository.save(settlement);
    }
    throw new Error(`Settlement with id ${id} not found`);
  }

  async update(
    id: string,
    updateData: Partial<Settlement>,
  ): Promise<Settlement> {
    await this.repository.update(id, updateData);
    const settlement = await this.findOne(id);
    if (!settlement) {
      throw new Error(`Settlement with id ${id} not found`);
    }
    return settlement;
  }

  async updateBatch(
    ids: string[],
    updateData: Partial<Settlement>,
  ): Promise<void> {
    if (ids.length > 0) {
      await this.repository.update(ids, updateData);
    }
  }

  async findByIds(ids: string[]): Promise<Settlement[]> {
    return this.repository.find({
      where: { id: In(ids) },
    });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async count(where?: FindOptionsWhere<Settlement>): Promise<number> {
    return this.repository.count({ where });
  }

  async findWithPagination(
    options: FindManyOptions<Settlement>,
  ): Promise<[Settlement[], number]> {
    return this.repository.findAndCount(options);
  }

  async findByMerchantAndStatus(
    merchantId: string,
    status: SettlementStatus,
    options?: FindManyOptions<Settlement>,
  ): Promise<Settlement[]> {
    return this.repository.find({
      where: { merchantId, status },
      ...options,
    });
  }

  async getSettlementStats(merchantId?: string): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    totalAmount: number;
    totalFees: number;
  }> {
    const query = this.repository.createQueryBuilder('settlement');

    if (merchantId) {
      query.where('settlement.merchantId = :merchantId', { merchantId });
    }

    const [total, pending, processing, completed, failed] = await Promise.all([
      query.clone().getCount(),
      query
        .clone()
        .where('settlement.status = :status', {
          status: SettlementStatus.PENDING,
        })
        .getCount(),
      query
        .clone()
        .where('settlement.status = :status', {
          status: SettlementStatus.PROCESSING,
        })
        .getCount(),
      query
        .clone()
        .where('settlement.status = :status', {
          status: SettlementStatus.COMPLETED,
        })
        .getCount(),
      query
        .clone()
        .where('settlement.status = :status', {
          status: SettlementStatus.FAILED,
        })
        .getCount(),
    ]);

    const amountQuery = merchantId
      ? this.repository
          .createQueryBuilder('settlement')
          .where('settlement.merchantId = :merchantId', { merchantId })
      : this.repository.createQueryBuilder('settlement');

    const totalAmountResult = await amountQuery
      .select('SUM(settlement.amount)', 'total')
      .getRawOne();

    const totalFeesResult = await amountQuery
      .select('SUM(settlement.feeAmount)', 'total')
      .getRawOne();

    return {
      total,
      pending,
      processing,
      completed,
      failed,
      totalAmount: parseFloat(totalAmountResult?.total || '0'),
      totalFees: parseFloat(totalFeesResult?.total || '0'),
    };
  }
}
