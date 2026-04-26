import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CronJobService } from '../cron/cron-job.service';
import { DailyPaymentVolume } from './entities/daily-payment-volume.view';

@Injectable()
export class AnalyticsRefreshService {
  private readonly logger = new Logger(AnalyticsRefreshService.name);

  constructor(
    @InjectRepository(DailyPaymentVolume)
    private readonly viewRepo: Repository<DailyPaymentVolume>,
    private readonly cronJobService: CronJobService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async refreshMaterializedViews(): Promise<void> {
    await this.cronJobService.run('refresh-mv-daily-payment-volume', async () => {
      await this.viewRepo.query(
        'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_payment_volume',
      );
      this.logger.log('Refreshed mv_daily_payment_volume');
    });
  }
}
