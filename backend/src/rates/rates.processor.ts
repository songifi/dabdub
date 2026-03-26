import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { RatesService } from './rates.service';

export const RATES_QUEUE = 'rates';
export const FETCH_RATE_JOB = 'fetch-rate';

@Processor(RATES_QUEUE)
export class RatesProcessor implements OnModuleInit {
  private readonly logger = new Logger(RatesProcessor.name);

  constructor(
    private readonly ratesService: RatesService,
    @InjectQueue(RATES_QUEUE) private readonly ratesQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ratesQueue.add(
      FETCH_RATE_JOB,
      {},
      { repeat: { every: 30_000 }, removeOnComplete: true, removeOnFail: false },
    );
  }

  @Process(FETCH_RATE_JOB)
  async handleFetchRate(_job: Job): Promise<void> {
    try {
      await this.ratesService.fetchAndCache();
    } catch (err) {
      // Log WARN only — do NOT evict Redis so last known rate stays alive
      this.logger.warn(`fetch-rate failed: ${(err as Error).message}`);
    }
  }
}
