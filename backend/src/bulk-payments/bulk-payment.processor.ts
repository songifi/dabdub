import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { BulkPayment, BulkPaymentStatus } from '../entities/bulk-payment.entity';
import { BulkPaymentRow, BulkPaymentRowStatus } from '../entities/bulk-payment-row.entity';
import { TransfersService } from '../../transfers/transfers.service';
import { UsersService } from '../../users/users.service';
import { EmailService } from '../../email/email.service';
import { BULK_PAYMENT_QUEUE, PROCESS_BULK_PAYMENT_JOB, ProcessBulkPaymentJobData } from '../bulk-payment.service';

@Injectable()
@Processor(BULK_PAYMENT_QUEUE)
export class BulkPaymentProcessor extends WorkerHost {
  private readonly logger = new Logger(BulkPaymentProcessor.name);

  constructor(
    @InjectRepository(BulkPayment)
    private readonly bulkPaymentRepo: Repository<BulkPayment>,

    @InjectRepository(BulkPaymentRow)
    private readonly bulkPaymentRowRepo: Repository<BulkPaymentRow>,

    private readonly transfersService: TransfersService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
  ) {
    super();
  }

  async process(job: Job<ProcessBulkPaymentJobData>): Promise<void> {
    const { bulkPaymentId } = job.data;

    this.logger.log(`Processing bulk payment ${bulkPaymentId}`);

    // Update status to processing
    await this.bulkPaymentRepo.update(bulkPaymentId, {
      status: BulkPaymentStatus.PROCESSING,
    });

    const bulkPayment = await this.bulkPaymentRepo.findOneOrFail({
      where: { id: bulkPaymentId },
    });

    const rows = await this.bulkPaymentRowRepo.find({
      where: { bulkPaymentId },
      order: { rowNumber: 'ASC' },
    });

    // Get initiator user for transfer
    const initiator = await this.usersService.findById(bulkPayment.initiatedBy);

    let successCount = 0;
    let failureCount = 0;

    // Process rows sequentially
    for (const row of rows) {
      try {
        this.logger.log(`Processing row ${row.rowNumber} for ${row.toUsername}`);

        // Create transfer
        const transfer = await this.transfersService.create(
          bulkPayment.initiatedBy,
          initiator.username,
          {
            toUsername: row.toUsername,
            amount: row.amountUsdc,
            note: row.note || undefined,
          },
        );

        // Mark as success
        await this.bulkPaymentRowRepo.update(row.id, {
          status: BulkPaymentRowStatus.SUCCESS,
          txId: transfer.id, // Assuming transfer.id is the txId
          processedAt: new Date(),
        });

        successCount++;
        this.logger.log(`Row ${row.rowNumber} processed successfully`);

      } catch (error) {
        this.logger.error(`Row ${row.rowNumber} failed: ${error.message}`);

        // Mark as failed
        await this.bulkPaymentRowRepo.update(row.id, {
          status: BulkPaymentRowStatus.FAILED,
          failureReason: error.message,
          processedAt: new Date(),
        });

        failureCount++;
      }
    }

    // Update bulk payment final status
    const finalStatus =
      failureCount === 0
        ? BulkPaymentStatus.COMPLETED
        : successCount === 0
        ? BulkPaymentStatus.PARTIAL_FAILURE
        : BulkPaymentStatus.PARTIAL_FAILURE;

    await this.bulkPaymentRepo.update(bulkPaymentId, {
      status: finalStatus,
      successCount,
      failureCount,
      completedAt: new Date(),
    });

    this.logger.log(
      `Bulk payment ${bulkPaymentId} completed: ${successCount} success, ${failureCount} failures`,
    );

    // Send summary email (mock implementation)
    await this.sendSummaryEmail(bulkPayment, successCount, failureCount);
  }

  private async sendSummaryEmail(
    bulkPayment: BulkPayment,
    successCount: number,
    failureCount: number,
  ): Promise<void> {
    try {
      // Mock email sending - in real implementation, you'd use EmailService
      this.logger.log(
        `Sending summary email for bulk payment ${bulkPayment.id} to user ${bulkPayment.initiatedBy}`,
      );

      // const user = await this.usersService.findById(bulkPayment.initiatedBy);
      // await this.emailService.sendBulkPaymentSummary(user.email, {
      //   label: bulkPayment.label,
      //   totalRows: bulkPayment.totalRows,
      //   successCount,
      //   failureCount,
      //   totalAmount: bulkPayment.totalAmountUsdc,
      // });

    } catch (error) {
      this.logger.error(`Failed to send summary email: ${error.message}`);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<ProcessBulkPaymentJobData>) {
    this.logger.log(`Bulk payment job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ProcessBulkPaymentJobData>, err: Error) {
    this.logger.error(`Bulk payment job ${job.id} failed: ${err.message}`);
  }
}