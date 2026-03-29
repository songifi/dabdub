import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Repository } from 'typeorm';
import { Job, Queue } from 'bull';
import * as Sentry from '@sentry/nestjs';
import {
  WITHDRAWAL_QUEUE,
  PROCESS_WITHDRAWAL_JOB,
  WithdrawalsService,
} from '../withdrawals.service';
import { Withdrawal } from '../entities/withdrawal.entity';
import { SorobanService } from '../../soroban/soroban.service';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
} from '../../transactions/entities/transaction.entity';
import { NotificationsService } from '../../notifications/notifications.service';
import { BalanceService } from '../../balance/balance.service';
import {
  COMPLIANCE_QUEUE,
  CHECK_TRANSACTION_JOB,
  type CheckTransactionJobData,
} from '../../compliance/compliance.service';
import { FeesService } from '../../fees/fees.service';
import { FeeType } from '../../fee-config/entities/fee-config.entity';

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
    private readonly balanceService: BalanceService,
    private readonly feesService: FeesService,

    @InjectQueue(COMPLIANCE_QUEUE)
    private readonly complianceQueue: Queue,
  ) {}

  @Process(PROCESS_WITHDRAWAL_JOB)
  async handle(job: Job<ProcessWithdrawalJobData>): Promise<void> {
    const { withdrawalId } = job.data;
    this.logger.log(`Processing withdrawal job for ${withdrawalId}`);
    let withdrawal: Withdrawal | null = null;

    // Wrap in Sentry span for performance monitoring
    await Sentry.startSpan(
      {
        op: 'bullmq.job',
        name: `process.${WITHDRAWAL_QUEUE}.${PROCESS_WITHDRAWAL_JOB}`,
        attributes: {
          queue: WITHDRAWAL_QUEUE,
          jobType: PROCESS_WITHDRAWAL_JOB,
          jobId: job.id?.toString() || 'unknown',
          withdrawalId,
        },
      },
      async () => {
        withdrawal = await this.withdrawalsService.markProcessing(withdrawalId);

        const result = (await this.sorobanService.withdraw(
          withdrawal.userId,
          withdrawal.amount,
        )) as { txHash?: string } | null;

        const txHash = result?.txHash ?? `withdrawal-${withdrawalId}`;

        const confirmed = await this.withdrawalsService.markConfirmed(
          withdrawalId,
          txHash,
        );

        const savedTx = await this.transactionRepo.save(
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

        if (withdrawal.feeConfigId && parseFloat(withdrawal.fee) > 0) {
          await this.feesService.recordFee({
            userId: withdrawal.userId,
            txType: FeeType.WITHDRAWAL,
            txId: savedTx.id,
            grossAmount: withdrawal.amount,
            feeAmount: withdrawal.fee,
            netAmount: withdrawal.netAmount,
            feeConfigId: withdrawal.feeConfigId,
          });
        }

        // Invalidate balance cache
        await this.balanceService.invalidateCache(withdrawal.userId);

        // Enqueue async AML compliance check (non-blocking)
        await this.complianceQueue.add(
          CHECK_TRANSACTION_JOB,
          {
            userId: withdrawal.userId,
            amount: parseFloat(withdrawal.netAmount),
            txId: savedTx.id,
          } satisfies CheckTransactionJobData,
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 3_000 },
            removeOnComplete: true,
          },
        );

        await this.notificationsService.notifyWithdrawalConfirmed(confirmed);

        this.logger.log(
          `Withdrawal ${withdrawalId} confirmed. txHash=${txHash}`,
        );
      },
    ).catch(async (error: unknown) => {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Withdrawal ${withdrawalId} failed: ${reason}`);

      // Capture exception with Sentry
      Sentry.withScope((scope) => {
        scope.setTag('module', 'payments');
        scope.setTag('jobType', 'withdrawal');
        scope.setExtra('withdrawalId', withdrawalId);
        scope.setExtra('jobId', job.id?.toString());
        Sentry.captureException(error);
      });

      await this.withdrawalsService.markFailed(withdrawalId, reason);
      if (withdrawal) {
        await this.notificationsService.notifyWithdrawalFailed(
          withdrawal,
          reason,
        );
      }

      throw error;
    });
  }
}
