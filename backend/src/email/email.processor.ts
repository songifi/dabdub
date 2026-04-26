import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bull';
import { EmailLog, EmailStatus } from './entities/email-log.entity';
import { NodemailerService } from './nodemailer.service';
import { EMAIL_QUEUE, EmailJobPayload } from './email.service';

@Processor(EMAIL_QUEUE)
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    @InjectRepository(EmailLog)
    private readonly logRepo: Repository<EmailLog>,
    private readonly mailer: NodemailerService,
  ) {}

  @Process()
  async handleSend(job: Job<EmailJobPayload>): Promise<void> {
    const { logId, to, templateAlias, mergeData } = job.data;

    await this.logRepo.update(logId, { attemptCount: job.attemptsMade + 1 });

    const { messageId } = await this.mailer.send(to, templateAlias, mergeData);

    await this.logRepo.update(logId, {
      status: EmailStatus.SENT,
      providerMessageId: messageId,
      sentAt: new Date(),
    });

    this.logger.log(`Email sent logId=${logId} messageId=${messageId}`);
  }

  @OnQueueFailed()
  async handleFailed(job: Job<EmailJobPayload>, err: Error): Promise<void> {
    const { logId } = job.data;
    // attempts=2 means: 1 initial attempt + 1 retry → exhausted after 2nd failure
    const isExhausted = job.attemptsMade >= (job.opts.attempts ?? 2);

    this.logger.warn(
      `Email job failed logId=${logId} attempt=${job.attemptsMade} exhausted=${isExhausted}: ${err.message}`,
    );

    if (isExhausted) {
      await this.logRepo.update(logId, {
        status: EmailStatus.FAILED,
        errorMessage: err.message,
      });
    }
  }
}
