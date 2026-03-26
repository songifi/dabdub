import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bull';
import {
  WITHDRAWAL_QUEUE,
  PROCESS_WITHDRAWAL_JOB,
  WithdrawalsService,
} from '../withdrawals.service';
import { Withdrawal } from '../entities/withdrawal.entity';
import { SorobanService } from '../../soroban/soroban.service';
import { Transaction, TransactionType, TransactionStatus } from '../../transactions/entities/transaction.entity';
import { NotificationsService } from '../../notifications/notifications.service';

export interface ProcessWithdrawalJobData {
  withdrawalId: string;
}

@Processor(WITHDRAWAL_QUEUE)
export class WithdrawalProcessor {
  private readonly logger = new Logger(WithdrawalProcessor.name);

  constructor(
    private readonly withdrawalsService: WithdrawalsService,
    private readonly sorobanService: SorobanService,

    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,

    private readonly notificationsService: NotificationsService,
  ) {}

  @Process(PROCESS_WITHDRAWAL_JOB)
  async handle(job: Job<ProcessWithdrawalJobData>): Promise<void> {
    const { withdrawalId } = job.data;
    this.logger.log(`Processing withdrawal job for ${withdrawalId}`);

    const withdrawal = await this.withdrawalsService.markProcessing(withdrawalId);

    try {
      const result = await this.sorobanService.withdraw(
        withdrawal.userId,
        withdrawal.amount,
      ) as { txHash?: string } | null;

      const txHash = result?.txHash ?? `withdrawal-${withdrawalId}`;

      const confirmed = await this.withdrawalsService.markConfirmed(withdrawalId, txHash);

      await this.transactionRepo.save(
        this.transactionRepo.create({
          userId: withdrawal.userId,
          type: TransactionType.WITHDRAWAL,
          amount: parseFloat(withdrawal.netAmount),
          currency: 'USDC',
          status: TransactionStatus.COMPLETED,
          reference: txHash,
          description: `USDC withdrawal to ${withdrawal.toAddress}`,
          withdrawalId: confirmed.id,
        }),
      );

      await this.notificationsService.notifyWithdrawalConfirmed(confirmed);

      this.logger.log(`Withdrawal ${withdrawalId} confirmed. txHash=${txHash}`);
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Withdrawal ${withdrawalId} failed: ${reason}`);

      await this.withdrawalsService.markFailed(withdrawalId, reason);
      await this.notificationsService.notifyWithdrawalFailed(withdrawal, reason);

      throw error;
    }
  }
}
