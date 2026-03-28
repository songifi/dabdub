import { Injectable, Logger, TimeoutException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CronJobLog, CronJobStatus } from './entities/cron-job-log.entity';

@Injectable()
export class CronJobService {
  private readonly logger = new Logger(CronJobService.name);

  constructor(
    @InjectRepository(CronJobLog)
    private logRepo: Repository<CronJobLog>,
  ) {}

  async run<T>(jobName: string, fn: () => Promise<T>, expectedItems?: number): Promise<T> {
    const log = this.logRepo.create({
      jobName,
      status: CronJobStatus.STARTED,
    });
    await this.logRepo.save(log);

    const start = Date.now();

    try {
      // 5 min timeout
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new TimeoutException(`Cron job ${jobName} exceeded 5min`)), 5 * 60 * 1000),
        ),
      ]);

      log.status = CronJobStatus.COMPLETED;
      log.completedAt = new Date();
      log.durationMs = Date.now() - start;
      log.itemsProcessed = expectedItems;
      await this.logRepo.save(log);

      this.logger.log(`Cron ${jobName} completed in ${log.durationMs}ms, processed ${log.itemsProcessed || 'N/A'}`);
      return result;
    } catch (error) {
      log.status = CronJobStatus.FAILED;
      log.completedAt = new Date();
      log.durationMs = Date.now() - start;
      log.errorMessage = error instanceof Error ? error.message : String(error);
      await this.logRepo.save(log);

      this.logger.error(`Cron ${jobName} failed: ${log.errorMessage} (${log.durationMs}ms)`);
      throw error;
    }
  }
}

