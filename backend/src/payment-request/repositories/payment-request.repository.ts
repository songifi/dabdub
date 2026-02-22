import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, FindManyOptions } from 'typeorm';
import {
  PaymentRequest,
  PaymentRequestStatus,
} from '../../database/entities/payment-request.entity';

@Injectable()
export class PaymentRequestRepository {
  constructor(
    @InjectRepository(PaymentRequest)
    private readonly repository: Repository<PaymentRequest>,
  ) {}

  async create(data: Partial<PaymentRequest>): Promise<PaymentRequest> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findById(id: string): Promise<PaymentRequest | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<PaymentRequest | null> {
    return this.repository.findOne({ where: { idempotencyKey } });
  }

  async findByTxHashAndNetwork(
    txHash: string,
    network: string,
  ): Promise<PaymentRequest | null> {
    return this.repository.findOne({
      where: { onChainTxHash: txHash, stellarNetwork: network },
    });
  }

  async update(
    id: string,
    data: Partial<PaymentRequest>,
  ): Promise<PaymentRequest> {
    await this.repository.update(id, data);
    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`Payment request ${id} not found after update`);
    }
    return updated;
  }

  async findExpired(now: Date): Promise<PaymentRequest[]> {
    return this.repository.find({
      where: {
        status: PaymentRequestStatus.PENDING,
        expiresAt: LessThanOrEqual(now),
      },
    });
  }

  async updateBatchStatus(
    ids: string[],
    status: PaymentRequestStatus,
  ): Promise<void> {
    if (ids.length > 0) {
      await this.repository.update(ids, { status });
    }
  }

  async search(params: {
    merchantId?: string;
    status?: PaymentRequestStatus;
    customerEmail?: string;
    stellarNetwork?: string;
    fromDate?: Date;
    toDate?: Date;
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'ASC' | 'DESC';
  }): Promise<[PaymentRequest[], number]> {
    const query = this.repository.createQueryBuilder('pr')
      .where('pr.isSandbox = :isSandbox', { isSandbox: false });

    if (params.merchantId) {
      query.andWhere('pr.merchantId = :merchantId', {
        merchantId: params.merchantId,
      });
    }
    if (params.status) {
      query.andWhere('pr.status = :status', { status: params.status });
    }
    if (params.customerEmail) {
      query.andWhere('pr.customerEmail = :customerEmail', {
        customerEmail: params.customerEmail,
      });
    }
    if (params.stellarNetwork) {
      query.andWhere('pr.stellarNetwork = :stellarNetwork', {
        stellarNetwork: params.stellarNetwork,
      });
    }
    if (params.fromDate) {
      query.andWhere('pr.createdAt >= :fromDate', {
        fromDate: params.fromDate,
      });
    }
    if (params.toDate) {
      query.andWhere('pr.createdAt <= :toDate', { toDate: params.toDate });
    }

    const allowedSortFields = [
      'createdAt',
      'amount',
      'status',
      'expiresAt',
      'updatedAt',
    ];
    const sortField = allowedSortFields.includes(params.sortBy)
      ? params.sortBy
      : 'createdAt';

    query.orderBy(`pr.${sortField}`, params.sortOrder);
    query.skip((params.page - 1) * params.limit);
    query.take(params.limit);

    return query.getManyAndCount();
  }

  async getStats(merchantId?: string): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
    expired: number;
    refunded: number;
    totalAmount: number;
    totalFees: number;
  }> {
    const query = this.repository.createQueryBuilder('pr')
      .where('pr.isSandbox = :isSandbox', { isSandbox: false });

    if (merchantId) {
      query.andWhere('pr.merchantId = :merchantId', { merchantId });
    }

    const statuses = [
      PaymentRequestStatus.PENDING,
      PaymentRequestStatus.PROCESSING,
      PaymentRequestStatus.COMPLETED,
      PaymentRequestStatus.FAILED,
      PaymentRequestStatus.CANCELLED,
      PaymentRequestStatus.EXPIRED,
      PaymentRequestStatus.REFUNDED,
    ];

    const [total, ...statusCounts] = await Promise.all([
      query.clone().getCount(),
      ...statuses.map((status) => {
        const q = this.repository.createQueryBuilder('pr')
          .where('pr.isSandbox = :isSandbox', { isSandbox: false });
        q.andWhere('pr.status = :status', { status });
        if (merchantId) {
          q.andWhere('pr.merchantId = :merchantId', { merchantId });
        }
        return q.getCount();
      }),
    ]);

    const amountQuery = this.repository.createQueryBuilder('pr')
      .where('pr.isSandbox = :isSandbox', { isSandbox: false });
    if (merchantId) {
      amountQuery.andWhere('pr.merchantId = :merchantId', { merchantId });
    }

    const totalAmountResult = await amountQuery
      .clone()
      .select('SUM(pr.amount)', 'total')
      .getRawOne();

    const totalFeesResult = await amountQuery
      .clone()
      .select('SUM(pr.feeAmount)', 'total')
      .getRawOne();

    return {
      total,
      pending: statusCounts[0],
      processing: statusCounts[1],
      completed: statusCounts[2],
      failed: statusCounts[3],
      cancelled: statusCounts[4],
      expired: statusCounts[5],
      refunded: statusCounts[6],
      totalAmount: parseFloat(totalAmountResult?.total || '0'),
      totalFees: parseFloat(totalFeesResult?.total || '0'),
    };
  }

  async getStatsInRange(
    merchantId?: string,
    fromDate?: Date,
    toDate?: Date,
  ): Promise<{
    total: number;
    totalAmount: number;
    completedCount: number;
    completedAmount: number;
  }> {
    const query = this.repository.createQueryBuilder('pr')
      .where('pr.isSandbox = :isSandbox', { isSandbox: false });

    if (merchantId) {
      query.andWhere('pr.merchantId = :merchantId', { merchantId });
    }
    if (fromDate) {
      query.andWhere('pr.createdAt >= :fromDate', { fromDate });
    }
    if (toDate) {
      query.andWhere('pr.createdAt <= :toDate', { toDate });
    }

    const total = await query.clone().getCount();

    const totalAmountResult = await query
      .clone()
      .select('SUM(pr.amount)', 'total')
      .getRawOne();

    const completedQuery = query.clone();
    completedQuery.andWhere('pr.status = :status', {
      status: PaymentRequestStatus.COMPLETED,
    });

    const completedCount = await completedQuery.clone().getCount();

    const completedAmountResult = await completedQuery
      .clone()
      .select('SUM(pr.amount)', 'total')
      .getRawOne();

    return {
      total,
      totalAmount: parseFloat(totalAmountResult?.total || '0'),
      completedCount,
      completedAmount: parseFloat(completedAmountResult?.total || '0'),
    };
  }
}
