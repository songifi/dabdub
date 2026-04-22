import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import {
  FraudService,
  FRAUD_QUEUE,
  FRAUD_CHECK_JOB,
  FraudCheckPayload,
  UserFreezePort,
  AdminNotificationPort,
} from './fraud.service';
import { RuleDependencies } from './rules/rule.interface';

/**
 * Stub implementations used by the processor.
 * Replace these with real injected services once user/notification modules exist.
 */
class StubUserFreezePort implements UserFreezePort {
  private readonly logger = new Logger('UserFreezePort');
  async freezeUser(userId: string): Promise<void> {
    this.logger.warn(`[STUB] Freeze user: ${userId}`);
  }
  async unfreezeUser(userId: string): Promise<void> {
    this.logger.warn(`[STUB] Unfreeze user: ${userId}`);
  }
}

class StubAdminNotificationPort implements AdminNotificationPort {
  private readonly logger = new Logger('AdminNotificationPort');
  async notifyAdmin(subject: string, body: string): Promise<void> {
    this.logger.warn(`[STUB] Admin notification — ${subject}: ${body}`);
  }
}

class StubRuleDependencies implements RuleDependencies {
  async countRecentTransfers(
    _userId: string,
    _windowMs: number,
  ): Promise<number> {
    return 0;
  }
  async getFirstTransactionDate(_userId: string): Promise<Date | null> {
    return null;
  }
}

@Processor(FRAUD_QUEUE)
export class FraudProcessor {
  private readonly logger = new Logger(FraudProcessor.name);

  constructor(private readonly fraudService: FraudService) {}

  @Process(FRAUD_CHECK_JOB)
  async handleFraudCheck(job: Job<FraudCheckPayload>): Promise<void> {
    const { userId, txId, context } = job.data;

    this.logger.debug(
      `Processing fraud check for userId="${userId}" txId="${txId}"`,
    );

    await this.fraudService.evaluate(
      userId,
      txId,
      context,
      new StubRuleDependencies(),
      {
        userFreeze: new StubUserFreezePort(),
        adminNotification: new StubAdminNotificationPort(),
      },
    );
  }
}
