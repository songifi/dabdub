import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OnRampService } from './onramp.service';

@Injectable()
export class OnRampCronService {
  private readonly logger = new Logger(OnRampCronService.name);

  constructor(private readonly onRampService: OnRampService) {}

  @Cron('*/5 * * * *') // Every 5 minutes
  async expireStaleOrders(): Promise<void> {
    try {
      const expiredCount = await this.onRampService.expireStaleOrders();
      if (expiredCount > 0) {
        this.logger.log(`Expired ${expiredCount} stale on-ramp orders`);
      }
    } catch (error) {
      this.logger.error('Failed to expire stale on-ramp orders:', error);
    }
  }
}
