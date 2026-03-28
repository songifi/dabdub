import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { SplitService, EXPIRE_SPLITS_JOB, SPLIT_QUEUE } from './split.service';

@Processor(SPLIT_QUEUE)
export class SplitProcessor {
  private readonly logger = new Logger(SplitProcessor.name);

  constructor(private readonly splitService: SplitService) {}

  @Process(EXPIRE_SPLITS_JOB)
  async handleExpire(_job: Job): Promise<void> {
    this.logger.log('Running split expiry check');
    await this.splitService.expireOverdue();
  }
}
