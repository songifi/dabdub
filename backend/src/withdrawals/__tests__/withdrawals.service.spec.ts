import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { WithdrawalsService, WITHDRAWAL_QUEUE } from '../withdrawals.service';
import { Withdrawal, WithdrawalStatus } from '../entities/withdrawal.entity';
import { FeeConfig, FeeType } from '../../fee-config/entities/fee-config.entity';
import { CreateWithdrawalDto } from '../dto/create-withdrawal.dto';

const VALID_STELLAR_ADDRESS = 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGYWDBEYW2FDIAXINBETLFA';

function mockRepo<T>(overrides: Partial<Repository<T>> = {}): jest.Mocked<Repository<T>> {
  return {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    ...overrides,
  } as unknown as jest.Mocked<Repository<T>>;
}

function buildActiveFeeConfig(overrides: Partial<FeeConfig> = {}): FeeConfig {
  return {
    id: 'fee-1',
    feeType: FeeType.WITHDRAWAL,
    baseFeeRate: '0.010000',
    minFee: '0.50',
    maxFee: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as FeeConfig;
}

describe('WithdrawalsService', () => {
  let service: WithdrawalsService;
  let withdrawalRepo: jest.Mocked<Repository<Withdrawal>>;
  let feeConfigRepo: jest.Mocked<Repository<FeeConfig>>;
  let queue: { add: jest.Mock };

  beforeEach(async () => {
    withdrawalRepo = mockRepo<Withdrawal>();
    feeConfigRepo = mockRepo<FeeConfig>();
    queue = { add: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalsService,
        { provide: getRepositoryToken(Withdrawal), useValue: withdrawalRepo },
        { provide: getRepositoryToken(FeeConfig), useValue: feeConfigRepo },
        { provide: getQueueToken(WITHDRAWAL_QUEUE), useValue: queue },
      ],
    }).compile();

    service = module.get(WithdrawalsService);
  });

  describe('create()', () => {
    const userId = 'user-abc';
    const dto: CreateWithdrawalDto = {
      toAddress: VALID_STELLAR_ADDRESS,
      amount: '100.000000',
    };

    it('creates a pending withdrawal and enqueues the job', async () => {
      withdrawalRepo.findOne.mockResolvedValue(null);
      feeConfigRepo.findOne.mockResolvedValue(buildActiveFeeConfig());

      const created: Partial<Withdrawal> = {
        id: 'w-1',
        userId,
        toAddress: dto.toAddress,
        amount: dto.amount,
        status: WithdrawalStatus.PENDING,
      };
      withdrawalRepo.create.mockReturnValue(created as Withdrawal);
      withdrawalRepo.save.mockResolvedValue(created as Withdrawal);

      const result = await service.create(userId, dto);

      expect(withdrawalRepo.findOne).toHaveBeenCalledWith({
        where: { userId, status: WithdrawalStatus.PENDING },
      });
      expect(withdrawalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          toAddress: dto.toAddress,
          amount: dto.amount,
          status: WithdrawalStatus.PENDING,
        }),
      );
      expect(withdrawalRepo.save).toHaveBeenCalled();
      expect(queue.add).toHaveBeenCalledWith(
        'process-withdrawal',
        { withdrawalId: 'w-1' },
        expect.objectContaining({ attempts: 3 }),
      );
      expect(result.status).toBe(WithdrawalStatus.PENDING);
    });

    it('throws 409 when a pending withdrawal already exists', async () => {
      withdrawalRepo.findOne.mockResolvedValue({ id: 'existing', status: WithdrawalStatus.PENDING } as Withdrawal);

      await expect(service.create(userId, dto)).rejects.toThrow(ConflictException);
      expect(withdrawalRepo.create).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('computeFee()', () => {
    it('applies percentage fee correctly', async () => {
      feeConfigRepo.findOne.mockResolvedValue(buildActiveFeeConfig({
        baseFeeRate: '0.010000',
        minFee: '0',
        maxFee: null,
      }));

      const { fee, netAmount } = await service.computeFee('200.000000');

      expect(parseFloat(fee)).toBeCloseTo(2, 4);
      expect(parseFloat(netAmount)).toBeCloseTo(198, 4);
    });

    it('clamps fee to minFee', async () => {
      feeConfigRepo.findOne.mockResolvedValue(buildActiveFeeConfig({
        baseFeeRate: '0.001000',
        minFee: '1.00',
        maxFee: null,
      }));

      const { fee } = await service.computeFee('10.000000');
      expect(parseFloat(fee)).toBeCloseTo(1, 4);
    });

    it('clamps fee to maxFee', async () => {
      feeConfigRepo.findOne.mockResolvedValue(buildActiveFeeConfig({
        baseFeeRate: '0.050000',
        minFee: '0',
        maxFee: '3.00',
      }));

      const { fee } = await service.computeFee('200.000000');
      expect(parseFloat(fee)).toBeCloseTo(3, 4);
    });

    it('returns zero fee when no active config exists', async () => {
      feeConfigRepo.findOne.mockResolvedValue(null);

      const { fee, netAmount } = await service.computeFee('50.000000');
      expect(fee).toBe('0');
      expect(netAmount).toBe('50.000000');
    });
  });

  describe('findOne()', () => {
    it('returns the withdrawal when found', async () => {
      const w = { id: 'w-1', userId: 'user-abc' } as Withdrawal;
      withdrawalRepo.findOne.mockResolvedValue(w);

      const result = await service.findOne('user-abc', 'w-1');
      expect(result).toBe(w);
    });

    it('throws NotFoundException when not found', async () => {
      withdrawalRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('user-abc', 'missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markFailed()', () => {
    it('sets status=failed and persists failureReason', async () => {
      const w = { id: 'w-1', status: WithdrawalStatus.PROCESSING } as Withdrawal;
      withdrawalRepo.findOneOrFail.mockResolvedValue(w);
      withdrawalRepo.save.mockResolvedValue({
        ...w,
        status: WithdrawalStatus.FAILED,
        failureReason: 'timeout',
      } as Withdrawal);

      const result = await service.markFailed('w-1', 'timeout');
      expect(result.status).toBe(WithdrawalStatus.FAILED);
      expect(result.failureReason).toBe('timeout');
    });
  });
});
