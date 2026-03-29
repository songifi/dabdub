import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { WithdrawalsService, WITHDRAWAL_QUEUE } from '../withdrawals.service';
import { Withdrawal, WithdrawalStatus } from '../entities/withdrawal.entity';
import { CreateWithdrawalDto } from '../dto/create-withdrawal.dto';
import { FeesService } from '../../fees/fees.service';

const VALID_STELLAR_ADDRESS =
  'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGYWDBEYW2FDIAXINBETLFA';

function mockRepo<T>(
  overrides: Partial<Repository<T>> = {},
): jest.Mocked<Repository<T>> {
  return {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    ...overrides,
  } as unknown as jest.Mocked<Repository<T>>;
}

describe('WithdrawalsService', () => {
  let service: WithdrawalsService;
  let withdrawalRepo: jest.Mocked<Repository<Withdrawal>>;
  let feesService: { computeFee: jest.Mock };
  let queue: { add: jest.Mock };

  beforeEach(async () => {
    withdrawalRepo = mockRepo<Withdrawal>();
    feesService = { computeFee: jest.fn() };
    queue = { add: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalsService,
        { provide: getRepositoryToken(Withdrawal), useValue: withdrawalRepo },
        { provide: FeesService, useValue: feesService },
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
      feesService.computeFee.mockResolvedValue({
        gross: dto.amount,
        fee: '1.00000000',
        net: '99.00000000',
        feeConfigId: 'cfg-1',
      });

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
      withdrawalRepo.findOne.mockResolvedValue({
        id: 'existing',
        status: WithdrawalStatus.PENDING,
      } as Withdrawal);

      await expect(service.create(userId, dto)).rejects.toThrow(
        ConflictException,
      );
      expect(withdrawalRepo.create).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('computeFee()', () => {
    it('applies percentage fee correctly', async () => {
      feesService.computeFee.mockResolvedValue({
        gross: '200.00000000',
        fee: '2.00000000',
        net: '198.00000000',
        feeConfigId: 'cfg-1',
      });

      const { fee, netAmount } = await service.computeFee('200.000000');

      expect(parseFloat(fee)).toBeCloseTo(2, 4);
      expect(parseFloat(netAmount)).toBeCloseTo(198, 4);
    });

    it('clamps fee to minFee', async () => {
      feesService.computeFee.mockResolvedValue({
        gross: '10.00000000',
        fee: '1.00000000',
        net: '9.00000000',
        feeConfigId: 'cfg-2',
      });

      const { fee } = await service.computeFee('10.000000');
      expect(parseFloat(fee)).toBeCloseTo(1, 4);
    });

    it('clamps fee to maxFee', async () => {
      feesService.computeFee.mockResolvedValue({
        gross: '200.00000000',
        fee: '3.00000000',
        net: '197.00000000',
        feeConfigId: 'cfg-3',
      });

      const { fee } = await service.computeFee('200.000000');
      expect(parseFloat(fee)).toBeCloseTo(3, 4);
    });

    it('surfaces missing fee config from FeesService', async () => {
      feesService.computeFee.mockRejectedValue(
        new Error('No active fee config found'),
      );

      await expect(service.computeFee('50.000000')).rejects.toThrow(
        'No active fee config found',
      );
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

      await expect(service.findOne('user-abc', 'missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markFailed()', () => {
    it('sets status=failed and persists failureReason', async () => {
      const w = {
        id: 'w-1',
        status: WithdrawalStatus.PROCESSING,
      } as Withdrawal;
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
