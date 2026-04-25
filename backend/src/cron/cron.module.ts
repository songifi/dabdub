import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../../notifications/notifications.module';
import { CronJobLog } from './entities/cron-job-log.entity';
import { CronJobService } from './cron-job.service';
import { CronHealthProcessor } from './cron-health.processor';
import { UptimeHeartbeatService } from './uptime-heartbeat.service';

const CRON_QUEUE = 'cron';

@Module({
  imports: [
    TypeOrmModule.forFeature([CronJobLog]),
    NotificationsModule,
    BullModule.registerQueue({ name: CRON_QUEUE }),
  ],
  providers: [CronJobService, CronHealthProcessor, UptimeHeartbeatService],
  exports: [CronJobService],
})
export class CronModule {}

