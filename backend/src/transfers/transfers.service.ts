import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Repository } from 'typeorm';
import { Queue } from 'bull';
import { Transfer, TransferStatus } from './entities/transfer.entity';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransferQueryDto, TransferDirection } from './dto/transfer-query.dto';
import { UsersService } from '../users/users.service';
import { TierService } from '../tier-config/tier.service';
import { FeeType } from '../fee-config/entities/fee-config.entity';
import { FeesService } from '../fees/fees.service';

export const TRANSFER_QUEUE = 'process-transfer';
export const PROCESS_TRANSFER_JOB = 'process-transfer';

export interface ProcessTransferJobData {
  transferId: string;
}

@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    @InjectRepository(Transfer)
    private readonly transferRepo: Repository<Transfer>,

    @InjectQueue(TRANSFER_QUEUE)
    private readonly transferQueue: Queue,

    private readonly usersService: UsersService,
    private readonly tierService: TierService,
    private readonly feesService: FeesService,
  ) {}

  // ── Create ────────────────────────────────────────────────────────────────

  async create(
    fromUserId: string,
    fromUsername: string,
    dto: CreateTransferDto,
  ): Promise<Transfer> {
    if (dto.toUsername.toLowerCase() === fromUsername.toLowerCase()) {
      throw new BadRequestException('Cannot transfer to yourself');
    }

    const toUser = await this.usersService.findByUsername(dto.toUsername);
    if (!toUser) {
      throw new NotFoundException(`User @${dto.toUsername} not found`);
    }

    const amount = parseFloat(dto.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }

    // Tier limit check (throws TierLimitExceededException → 403 if exceeded)
    await this.tierService.checkTransferLimit(fromUserId, amount);

    const computedFee = await this.feesService.computeFee(
      FeeType.TRANSFER,
      dto.amount,
    );

    const transfer = this.transferRepo.create({
      fromUserId,
      toUserId: toUser.id,
      fromUsername,
      toUsername: toUser.username,
      amount: dto.amount,
      fee: computedFee.fee,
      netAmount: computedFee.net,
      note: dto.note ?? null,
      status: TransferStatus.PENDING,
      feeConfigId: computedFee.feeConfigId,
    });

    await this.transferRepo.save(transfer);

    await this.transferQueue.add(
      PROCESS_TRANSFER_JOB,
      { transferId: transfer.id } satisfies ProcessTransferJobData,
      { attempts: 1, removeOnComplete: true, removeOnFail: false },
    );

    return transfer;
  }

  // ── Find ──────────────────────────────────────────────────────────────────

  async findAll(
    userId: string,
    query: TransferQueryDto,
  ): Promise<{ data: Transfer[]; nextCursor: string | null }> {
    const limit = Math.min(query.limit ?? 20, 100);

    const qb = this.transferRepo
      .createQueryBuilder('t')
      .orderBy('t.createdAt', 'DESC')
      .limit(limit + 1);

    if (query.direction === TransferDirection.SENT) {
      qb.where('t.from_user_id = :userId', { userId });
    } else if (query.direction === TransferDirection.RECEIVED) {
      qb.where('t.to_user_id = :userId', { userId });
    } else {
      qb.where('t.from_user_id = :userId OR t.to_user_id = :userId', {
        userId,
      });
    }

    if (query.cursor) {
      const cursor = await this.transferRepo.findOne({
        where: { id: query.cursor },
      });
      if (cursor) {
        qb.andWhere('t.createdAt < :cursorDate', {
          cursorDate: cursor.createdAt,
        });
      }
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return { data, nextCursor };
  }

  async findOne(userId: string, id: string): Promise<Transfer> {
    const transfer = await this.transferRepo.findOne({ where: { id } });
    if (
      !transfer ||
      (transfer.fromUserId !== userId && transfer.toUserId !== userId)
    ) {
      throw new NotFoundException('Transfer not found');
    }
    return transfer;
  }

  // ── Status helpers (used by processor) ───────────────────────────────────

  async markConfirmed(id: string, txHash: string): Promise<Transfer> {
    await this.transferRepo.update(id, {
      status: TransferStatus.CONFIRMED,
      txHash,
    });
    return this.transferRepo.findOneOrFail({ where: { id } });
  }

  async markFailed(id: string): Promise<void> {
    await this.transferRepo.update(id, { status: TransferStatus.FAILED });
  }
}
