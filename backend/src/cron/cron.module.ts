import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CronJobLog } from './entities/cron-job-log.entity';
import { CronJobService } from './cron-job.service';
import { CronHealthProcessor } from './cron-health.processor';

const CRON_QUEUE = 'cron';

@Module({
  imports: [
    TypeOrmModule.forFeature([CronJobLog]),
    BullModule.registerQueue({ name: CRON_QUEUE }),
  ],
  providers: [CronJobService, CronHealthProcessor],
  exports: [CronJobService],
})
export class CronModule {}

