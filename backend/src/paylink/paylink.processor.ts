import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PayLinkService } from './paylink.service';

export const PAYLINK_QUEUE = 'paylink-jobs';
export const EXPIRE_PAYLINKS_JOB = 'expire-paylinks';

@Processor(PAYLINK_QUEUE)
export class PayLinkProcessor {
  private readonly logger = new Logger(PayLinkProcessor.name);

  constructor(private readonly payLinkService: PayLinkService) {}

  @Process(EXPIRE_PAYLINKS_JOB)
  async markExpired(_job: Job): Promise<void> {
    const affected = await this.payLinkService.markExpiredPayLinks();
    if (affected > 0) {
      this.logger.log(`Marked ${affected} PayLinks as expired`);
    }
  }
}
