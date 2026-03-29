import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { RatesService } from './rates.service';
import { RateAlertService } from './rate-alert.service';
import { CronJobService } from '../cron/cron-job.service';

export const RATES_QUEUE = 'rates';
export const FETCH_RATE_JOB = 'fetch-rate';

@Processor(RATES_QUEUE)
export class RatesProcessor implements OnModuleInit {
  private readonly logger = new Logger(RatesProcessor.name);

  constructor(
    private readonly ratesService: RatesService,
    private readonly rateAlertService: RateAlertService,
    @InjectQueue(RATES_QUEUE) private readonly ratesQueue: Queue,
    private readonly cronJobService: CronJobService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ratesQueue.add(
      FETCH_RATE_JOB,
      {},
      {
        repeat: { every: 30_000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  @Process(FETCH_RATE_JOB)
  async handleFetchRate(_job: Job): Promise<void> {
    await this.cronJobService.run('fetch-exchange-rate', async () => {
      try {
        const snapshot = await this.ratesService.fetchAndCache();
        await this.rateAlertService.checkAlerts(parseFloat(snapshot.rate));
      } catch (err) {
        this.logger.warn(`fetch-rate failed: ${(err as Error).message}`);
      }
    });
  }
}
