import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FeeConfig,
  FeeRateType,
  FeeType,
} from '../fee-config/entities/fee-config.entity';
import { FeeRecord } from './entities/fee-record.entity';
import { NoFeeConfigException } from './exceptions/no-fee-config.exception';
import { FeesService } from './fees.service';

describe('FeesService', () => {
  let service: FeesService;
  let feeConfigRepo: jest.Mocked<Repository<FeeConfig>>;
  let feeConfigQueryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    addOrderBy: jest.Mock;
    getOne: jest.Mock;
  };

  beforeEach(async () => {
    feeConfigQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };

    feeConfigRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(feeConfigQueryBuilder),
      create: jest.fn(),
      save: jest.fn(),
      findOneOrFail: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<FeeConfig>>;

    const feeRecordRepo = {
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<FeeRecord>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeesService,
        { provide: getRepositoryToken(FeeConfig), useValue: feeConfigRepo },
        { provide: getRepositoryToken(FeeRecord), useValue: feeRecordRepo },
      ],
    }).compile();

    service = module.get<FeesService>(FeesService);
  });

  it('computes percent fee: 100 at 0.5% = 0.50', async () => {
    feeConfigQueryBuilder.getOne.mockResolvedValue({
      id: 'cfg-percent',
      feeType: FeeType.TRANSFER,
      rateType: FeeRateType.PERCENT,
      value: '0.5',
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      isActive: true,
      createdBy: 'admin-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies Partial<FeeConfig>);

    const result = await service.computeFee(FeeType.TRANSFER, '100');

    expect(result.gross).toBe('100.00000000');
    expect(result.fee).toBe('0.50000000');
    expect(result.net).toBe('99.50000000');
    expect(result.feeConfigId).toBe('cfg-percent');
  });

  it('computes flat fee: any amount uses fixed value', async () => {
    feeConfigQueryBuilder.getOne.mockResolvedValue({
      id: 'cfg-flat',
      feeType: FeeType.WITHDRAWAL,
      rateType: FeeRateType.FLAT,
      value: '2.75',
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      isActive: true,
      createdBy: 'admin-2',
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies Partial<FeeConfig>);

    const result = await service.computeFee(FeeType.WITHDRAWAL, '150');

    expect(result.gross).toBe('150.00000000');
    expect(result.fee).toBe('2.75000000');
    expect(result.net).toBe('147.25000000');
    expect(result.feeConfigId).toBe('cfg-flat');
  });

  it('throws NoFeeConfigException when no active config exists', async () => {
    feeConfigQueryBuilder.getOne.mockResolvedValue(null);

    await expect(
      service.computeFee(FeeType.PAYLINK, '100'),
    ).rejects.toBeInstanceOf(NoFeeConfigException);
  });
});
