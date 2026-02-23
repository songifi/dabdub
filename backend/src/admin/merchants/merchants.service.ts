import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import {
  Merchant,
  MerchantStatus,
} from '../../database/entities/merchant.entity';
import { RedisService } from '../../common/redis';
import { ListMerchantsQueryDto } from './dto/list-merchants-query.dto';

const SORT_BY_TO_DB_COLUMN: Record<string, string> = {
  createdAt: 'created_at',
  businessName: 'business_name',
  totalVolumeUsd: 'total_volume_usd',
  totalTransactionCount: 'total_transaction_count',
  activatedAt: 'activated_at',
};

@Injectable()
export class MerchantsService {
  constructor(
    @InjectRepository(Merchant)
    private readonly merchantRepo: Repository<Merchant>,
    private readonly redisService: RedisService,
  ) {}

  async listMerchants(query: ListMerchantsQueryDto) {
    const {
      page = 1,
      limit = 20,
      status,
      countryCode,
      tier,
      businessType,
      createdAfter,
      createdBefore,
      minVolumeUsd,
      maxVolumeUsd,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const sortedParams = JSON.stringify(
      Object.fromEntries(
        Object.entries(query).sort(([a], [b]) => a.localeCompare(b)),
      ),
    );
    const hash = createHash('md5').update(sortedParams).digest('hex');
    const cacheKey = `cache:merchants:list:${hash}`;

    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const qb = this.merchantRepo.createQueryBuilder('merchants');

    if (status) qb.andWhere('merchants.status = :status', { status });
    if (countryCode)
      qb.andWhere('merchants.country = :countryCode', { countryCode });
    if (tier) qb.andWhere("merchants.settings->>'tier' = :tier", { tier });
    if (businessType)
      qb.andWhere('merchants.business_type = :businessType', { businessType });
    if (createdAfter)
      qb.andWhere('merchants.created_at >= :createdAfter', { createdAfter });
    if (createdBefore)
      qb.andWhere('merchants.created_at <= :createdBefore', { createdBefore });
    if (minVolumeUsd)
      qb.andWhere('merchants.total_volume_usd >= :minVolumeUsd', {
        minVolumeUsd,
      });
    if (maxVolumeUsd)
      qb.andWhere('merchants.total_volume_usd <= :maxVolumeUsd', {
        maxVolumeUsd,
      });

    if (search) {
      const searchParam = `%${search}%`;
      qb.andWhere(
        `(
          merchants.business_name ILIKE :search
          OR merchants.email ILIKE :search
          OR merchants.business_registration_number ILIKE :search
          OR merchants.name ILIKE :search
        )`,
        { search: searchParam },
      );
    }

    const sortColumn =
      SORT_BY_TO_DB_COLUMN[sortBy] ?? SORT_BY_TO_DB_COLUMN.createdAt;

    qb.orderBy(`merchants.${sortColumn}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    const statusQb = this.merchantRepo
      .createQueryBuilder('m')
      .select('m.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('m.status');

    if (countryCode)
      statusQb.andWhere('m.country = :countryCode', { countryCode });
    if (tier) statusQb.andWhere("m.settings->>'tier' = :tier", { tier });
    if (businessType)
      statusQb.andWhere('m.business_type = :businessType', { businessType });
    if (createdAfter)
      statusQb.andWhere('m.created_at >= :createdAfter', { createdAfter });
    if (createdBefore)
      statusQb.andWhere('m.created_at <= :createdBefore', { createdBefore });
    if (minVolumeUsd)
      statusQb.andWhere('m.total_volume_usd >= :minVolumeUsd', {
        minVolumeUsd,
      });
    if (maxVolumeUsd)
      statusQb.andWhere('m.total_volume_usd <= :maxVolumeUsd', {
        maxVolumeUsd,
      });
    if (search) {
      const searchParam = `%${search}%`;
      statusQb.andWhere(
        `(
          m.business_name ILIKE :search
          OR m.email ILIKE :search
          OR m.business_registration_number ILIKE :search
          OR m.name ILIKE :search
        )`,
        { search: searchParam },
      );
    }

    const statusCounts = await statusQb.getRawMany<{
      status: MerchantStatus;
      count: string;
    }>();
    const byStatus = Object.values(MerchantStatus).reduce(
      (acc, merchantStatus) => ({ ...acc, [merchantStatus]: 0 }),
      {} as Record<MerchantStatus, number>,
    );

    statusCounts.forEach((row) => {
      byStatus[row.status] = parseInt(row.count, 10);
    });

    const result = {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      summary: { byStatus },
    };

    await this.redisService.set(cacheKey, result, 30);

    return result;
  }
}
