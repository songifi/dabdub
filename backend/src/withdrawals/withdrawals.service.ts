import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Repository } from 'typeorm';
import { Queue } from 'bull';
import { Withdrawal, WithdrawalStatus } from './entities/withdrawal.entity';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { WithdrawalQueryDto } from './dto/withdrawal-query.dto';
import { FeeConfig, FeeType } from '../fee-config/entities/fee-config.entity';

export const WITHDRAWAL_QUEUE = 'process-withdrawal';
export const PROCESS_WITHDRAWAL_JOB = 'process-withdrawal';

@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  constructor(
    @InjectRepository(Withdrawal)
    private readonly withdrawalRepo: Repository<Withdrawal>,

    @InjectRepository(FeeConfig)
    private readonly feeConfigRepo: Repository<FeeConfig>,

    @InjectQueue(WITHDRAWAL_QUEUE)
    private readonly withdrawalQueue: Queue,
  ) {}

  async create(userId: string, dto: CreateWithdrawalDto): Promise<Withdrawal> {
    const existing = await this.withdrawalRepo.findOne({
      where: { userId, status: WithdrawalStatus.PENDING },
    });
    if (existing) {
      throw new ConflictException(
        'You already have a pending withdrawal. Wait for it to complete before creating another.',
      );
    }

    const { fee, netAmount } = await this.computeFee(dto.amount);

    const withdrawal = this.withdrawalRepo.create({
      userId,
      toAddress: dto.toAddress,
      amount: dto.amount,
      fee,
      netAmount,
      status: WithdrawalStatus.PENDING,
      txHash: null,
      failureReason: null,
    });
    const saved = await this.withdrawalRepo.save(withdrawal);

    await this.withdrawalQueue.add(
      PROCESS_WITHDRAWAL_JOB,
      { withdrawalId: saved.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 5_000 } },
    );

    this.logger.log(
      `Withdrawal ${saved.id} created for user ${userId}: ${dto.amount} USDC → net ${netAmount} USDC`,
    );

    return saved;
  }

  async findAll(
    userId: string,
    query: WithdrawalQueryDto,
  ): Promise<{ data: Withdrawal[]; total: number; page: number; limit: number }> {
    const { page, limit } = query;
    const [data, total] = await this.withdrawalRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async findOne(userId: string, id: string): Promise<Withdrawal> {
    const withdrawal = await this.withdrawalRepo.findOne({ where: { id, userId } });
    if (!withdrawal) {
      throw new NotFoundException(`Withdrawal ${id} not found`);
    }
    return withdrawal;
  }

  async computeFee(grossAmount: string): Promise<{ fee: string; netAmount: string }> {
    const config = await this.feeConfigRepo.findOne({
      where{ feeType: FeeType.WITHDRAWAL, isActive: true },
    });

    const gross = parseFloat(grossAmount);

    if (!config) {
      return { fee: '0', netAmount: grossAmount };
    }

    const rate = parseFloat(config.baseFeeRate);
    let fee = gross * rate;

    const min = parseFloat(config.minFee);
    if (fee < min) fee = min;

    if (config.maxFee !== null) {
      const max = parseFloat(config.maxFee);
      if (fee > max) fee = max;
    }

    const net = gross - fee;

    return {
      fee: fee.toFixed(6),
      netAmount: net.toFixed(6),
    };
  }

  async markProcessing(withdrawalId: string): Promise<Withdrawal> {
    const withdrawal = await this.withdrawalRepo.findOneOrFail({ where: { id: withdrawalId } });
    withdrawal.status = WithdrawalStatus.PROCESSING;
    return this.withdrawalRepo.save(withdrawal);
  }

  async markConfirmed(withdrawalId: string, txHash: string): Promise<Withdrawal> {
    const withdrawal = await this.withdrawalRepo.findOneOrFail({ where: { id: withdrawalId } });
    withdrawal.status = WithdrawalStatus.CONFIRMED;
    withdrawal.txHash = txHash;
    return this.withdrawalRepo.save(withdrawal);
  }

  async markFailed(withdrawalId: string, reason: string): Promise<Withdrawal> {
    const withdrawal = await this.withdrawalRepo.findOneOrFail({ where: { id: withdrawalId } });
    withdrawal.status = WithdrawalStatus.FAILED;
    withdrawal.failureReason = reason;
    return this.withdrawalRepo.save(withdrawal);
  }
}
