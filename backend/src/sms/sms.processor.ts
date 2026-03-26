import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bull';
import { SmsLog, SmsStatus } from './entities/sms-log.entity';
import { TermiiService } from './termii.service';
import { SMS_QUEUE, SmsJobPayload } from './sms.service';

@Processor(SMS_QUEUE)
export class SmsProcessor {
  private readonly logger = new Logger(SmsProcessor.name);

  constructor(
    @InjectRepository(SmsLog)
    private readonly logRepo: Repository<SmsLog>,
    private readonly termii: TermiiService,
  ) {}

  @Process()
  async handleSend(job: Job<SmsJobPayload>): Promise<void> {
    const { logId, phone, message } = job.data;

    const { messageId } = await this.termii.send(phone, message);

    await this.logRepo.update(logId, {
      status: SmsStatus.SENT,
      providerRef: messageId,
      sentAt: new Date(),
    });

    this.logger.log(`SMS sent logId=${logId} messageId=${messageId}`);
  }

  @OnQueueFailed()
  async handleFailed(job: Job<SmsJobPayload>, err: Error): Promise<void> {
    const { logId } = job.data;
    const isExhausted = job.attemptsMade >= (job.opts.attempts ?? 3);

    this.logger.warn(
      `SMS job failed logId=${logId} attempt=${job.attemptsMade} exhausted=${isExhausted}: ${err.message}`,
    );

    if (isExhausted) {
      await this.logRepo.update(logId, {
        status: SmsStatus.FAILED,
        errorMessage: err.message,
      });
    }
  }
}
