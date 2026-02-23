import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MerchantsService } from './merchants.service';
import {
  Merchant,
  MerchantStatus,
} from '../../database/entities/merchant.entity';
import { RedisService } from '../../common/redis';
import { MerchantTier } from '../../merchant/dto/merchant.dto';
import { BusinessType } from './dto/list-merchants-query.dto';

const listQb: any = {
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
};

const summaryQb: any = {
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getRawMany: jest.fn(),
};

const mockRepo = {
  createQueryBuilder: jest.fn(),
};

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  delPattern: jest.fn(),
};

describe('MerchantsService', () => {
  let service: MerchantsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRepo.createQueryBuilder
      .mockReturnValueOnce(listQb)
      .mockReturnValueOnce(summaryQb);
    listQb.getManyAndCount.mockResolvedValue([[], 0]);
    summaryQb.getRawMany.mockResolvedValue([]);
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantsService,
        { provide: getRepositoryToken(Merchant), useValue: mockRepo },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<MerchantsService>(MerchantsService);
  });

  it('applies each filter when provided', async () => {
    mockRepo.createQueryBuilder
      .mockReturnValueOnce(listQb)
      .mockReturnValueOnce(summaryQb);

    await service.listMerchants({
      status: MerchantStatus.ACTIVE,
      countryCode: 'US',
      tier: MerchantTier.GROWTH,
      businessType: BusinessType.LLC,
      createdAfter: '2025-01-01T00:00:00.000Z',
      createdBefore: '2025-12-31T23:59:59.999Z',
      minVolumeUsd: '100',
      maxVolumeUsd: '1000',
    } as any);

    expect(listQb.andWhere).toHaveBeenCalledWith('merchants.status = :status', {
      status: MerchantStatus.ACTIVE,
    });
    expect(listQb.andWhere).toHaveBeenCalledWith(
      'merchants.country = :countryCode',
      {
        countryCode: 'US',
      },
    );
    expect(listQb.andWhere).toHaveBeenCalledWith(
      "merchants.settings->>'tier' = :tier",
      {
        tier: MerchantTier.GROWTH,
      },
    );
    expect(listQb.andWhere).toHaveBeenCalledWith(
      'merchants.business_type = :businessType',
      {
        businessType: BusinessType.LLC,
      },
    );
    expect(listQb.andWhere).toHaveBeenCalledWith(
      'merchants.total_volume_usd >= :minVolumeUsd',
      {
        minVolumeUsd: '100',
      },
    );
    expect(listQb.andWhere).toHaveBeenCalledWith(
      'merchants.total_volume_usd <= :maxVolumeUsd',
      {
        maxVolumeUsd: '1000',
      },
    );
  });

  it('applies multiple filters using AND logic', async () => {
    mockRepo.createQueryBuilder
      .mockReturnValueOnce(listQb)
      .mockReturnValueOnce(summaryQb);

    await service.listMerchants({
      status: MerchantStatus.ACTIVE,
      countryCode: 'US',
      businessType: BusinessType.LLC,
    } as any);

    const whereClauses = listQb.andWhere.mock.calls.map(
      (call: any[]) => call[0],
    );
    expect(whereClauses).toContain('merchants.status = :status');
    expect(whereClauses).toContain('merchants.country = :countryCode');
    expect(whereClauses).toContain('merchants.business_type = :businessType');
  });

  it('search is case-insensitive across all fields', async () => {
    mockRepo.createQueryBuilder
      .mockReturnValueOnce(listQb)
      .mockReturnValueOnce(summaryQb);

    await service.listMerchants({ search: 'AcMe' } as any);

    expect(listQb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('ILIKE :search'),
      { search: '%AcMe%' },
    );
  });

  it('uses cache on second identical request', async () => {
    const cached = {
      data: [{ id: 'm1' }],
      meta: { total: 1 },
      summary: { byStatus: {} },
    };
    mockRedis.get.mockResolvedValueOnce(null).mockResolvedValueOnce(cached);

    mockRepo.createQueryBuilder
      .mockReturnValueOnce(listQb)
      .mockReturnValueOnce(summaryQb);

    const first = await service.listMerchants({
      status: MerchantStatus.ACTIVE,
    } as any);
    const second = await service.listMerchants({
      status: MerchantStatus.ACTIVE,
    } as any);

    expect(first).toBeDefined();
    expect(second).toEqual(cached);
    expect(mockRepo.createQueryBuilder).toHaveBeenCalledTimes(2);
    expect(mockRedis.set).toHaveBeenCalledTimes(1);
  });

  it('sorts by totalVolumeUsd DESC', async () => {
    mockRepo.createQueryBuilder
      .mockReturnValueOnce(listQb)
      .mockReturnValueOnce(summaryQb);

    await service.listMerchants({
      sortBy: 'totalVolumeUsd',
      sortOrder: 'DESC',
    } as any);

    expect(listQb.orderBy).toHaveBeenCalledWith(
      'merchants.total_volume_usd',
      'DESC',
    );
  });
});
