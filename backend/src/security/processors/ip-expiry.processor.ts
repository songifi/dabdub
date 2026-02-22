import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { IpBlockService } from '../services/ip-block.service';

@Processor('ip-expiry')
export class IpExpiryProcessor {
  private readonly logger = new Logger(IpExpiryProcessor.name);

  constructor(private readonly ipBlockService: IpBlockService) {}

  @Process('expire-ip')
  async handleExpiry(job: Job<{ id: string }>) {
    this.logger.log(`Expirying IP block with ID: ${job.data.id}`);
    try {
      await this.ipBlockService.unblockIp(job.data.id, 'system-auto-expiry');
    } catch (error) {
      this.logger.error(`Failed to expire IP block ${job.data.id}`, error.stack);
      throw error;
    }
  }
}
