import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bull';
import {
  TRANSFER_QUEUE,
  PROCESS_TRANSFER_JOB,
  TransfersService,
  ProcessTransferJobData,
} from '../transfers.service';
import { Transfer } from '../entities/transfer.entity';
import { SorobanService } from '../../soroban/soroban.service';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
} from '../../transactions/entities/transaction.entity';
import { NotificationService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/notifications.types';
import { WS_EVENTS } from '../../ws/cheese.gateway';
import { CheeseGateway } from '../../ws/cheese.gateway';
import { EmailService } from '../../email/email.service';
import { UsersService } from '../../users/users.service';

@Processor(TRANSFER_QUEUE)
export class TransferProcessor {
  private readonly logger = new Logger(TransferProcessor.name);

  constructor(
    private readonly transfersService: TransfersService,
    private readonly sorobanService: SorobanService,
    private readonly notificationService: NotificationService,
    private readonly gateway: CheeseGateway,
    private readonly emailService: EmailService,
    private readonly usersService: UsersService,

    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,

    @InjectRepository(Transfer)
    private readonly transferRepo: Repository<Transfer>,
  ) {}

  @Process(PROCESS_TRANSFER_JOB)
  async handle(job: Job<ProcessTransferJobData>): Promise<void> {
    const { transferId } = job.data;
    this.logger.log(`Processing transfer ${transferId}`);

    const transfer = await this.transferRepo.findOneOrFail({ where: { id: transferId } });

    try {
      const result = await this.sorobanService.transfer(
        transfer.fromUsername,
        transfer.toUsername,
        transfer.amount,
        transfer.note ?? undefined,
      ) as { txHash?: string } | null;

      const txHash = result?.txHash ?? `transfer-${transferId}`;
      const confirmed = await this.transfersService.markConfirmed(transferId, txHash);

      // Create Transaction records for both parties
      await this.transactionRepo.save([
        this.transactionRepo.create({
          userId: transfer.fromUserId,
          type: TransactionType.TRANSFER_OUT,
          amountUsdc: transfer.amount,
          amount: parseFloat(transfer.amount),
          currency: 'USDC',
          fee: transfer.fee,
          balanceAfter: '0',
          status: TransactionStatus.COMPLETED,
          reference: txHash,
          counterpartyUsername: transfer.toUsername,
          description: transfer.note ?? `Transfer to @${transfer.toUsername}`,
          metadata: { transferId },
        }),
        this.transactionRepo.create({
          userId: transfer.toUserId,
          type: TransactionType.TRANSFER_IN,
          amountUsdc: transfer.netAmount,
          amount: parseFloat(transfer.netAmount),
          currency: 'USDC',
          fee: '0',
          balanceAfter: '0',
          status: TransactionStatus.COMPLETED,
          reference: txHash,
          counterpartyUsername: transfer.fromUsername,
          description: transfer.note ?? `Transfer from @${transfer.fromUsername}`,
          metadata: { transferId },
        }),
      ]);

      // WebSocket events
      await this.gateway.emitToUser(transfer.fromUserId, WS_EVENTS.TRANSFER_SENT, confirmed);
      await this.gateway.emitToUser(transfer.toUserId, WS_EVENTS.TRANSFER_RECEIVED, confirmed);

      // In-app notifications
      await Promise.all([
        this.notificationService.create(
          transfer.fromUserId,
          NotificationType.TRANSFER_SENT,
          'Transfer sent',
          `You sent ${transfer.amount} USDC to @${transfer.toUsername}`,
          { transferId },
        ),
        this.notificationService.create(
          transfer.toUserId,
          NotificationType.TRANSFER_RECEIVED,
          'Transfer received',
          `You received ${transfer.netAmount} USDC from @${transfer.fromUsername}`,
          { transferId },
        ),
      ]);

      // Email to receiver (best-effort)
      try {
        const receiver = await this.usersService.findById(transfer.toUserId);
        if (receiver?.email) {
          await this.emailService.queue(
            receiver.email,
            'transfer-received',
            {
              username: receiver.username,
              fromUsername: transfer.fromUsername,
              amount: transfer.netAmount,
              note: transfer.note ?? '',
            },
            transfer.toUserId,
          );
        }
      } catch (err) {
        this.logger.warn(`Email queue failed for transfer ${transferId}: ${(err as Error).message}`);
      }
    } catch (err) {
      this.logger.error(`Transfer ${transferId} failed: ${(err as Error).message}`);
      await this.transfersService.markFailed(transferId);
    }
  }

  @OnQueueFailed()
  async onFailed(job: Job<ProcessTransferJobData>, err: Error): Promise<void> {
    this.logger.error(`Transfer job failed transferId=${job.data.transferId}: ${err.message}`);
    await this.transfersService.markFailed(job.data.transferId);
  }
}
