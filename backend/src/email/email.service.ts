import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EmailLog, EmailStatus } from './entities/email-log.entity';

export const EMAIL_QUEUE = 'email-jobs';

export interface EmailJobPayload {
  logId: string;
  to: string;
  templateAlias: string;
  mergeData: Record<string, unknown>;
}

// Retry delays: 30s, 2min, 10min
const BACKOFF_DELAYS = [30_000, 120_000, 600_000];

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @InjectRepository(EmailLog)
    private readonly logRepo: Repository<EmailLog>,
    @InjectQueue(EMAIL_QUEUE)
    private readonly emailQueue: Queue<EmailJobPayload>,
  ) {}

  async queue(
    to: string,
    templateAlias: string,
    mergeData: Record<string, unknown>,
    userId?: string,
  ): Promise<EmailLog> {
    const log = await this.logRepo.save(
      this.logRepo.create({
        to,
        templateAlias,
        subject: templateAlias,
        status: EmailStatus.QUEUED,
        userId: userId ?? null,
      }),
    );

    await this.emailQueue.add(
      { logId: log.id, to, templateAlias, mergeData },
      {
        attempts: 3,
        backoff: { type: 'custom' },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log(`Queued email logId=${log.id} to=${to} template=${templateAlias}`);
    return log;
  }

  getBackoffDelay(attemptsMade: number): number {
    return BACKOFF_DELAYS[attemptsMade] ?? BACKOFF_DELAYS[BACKOFF_DELAYS.length - 1];
  }
}
