import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminAlertModule } from '../alerts/admin-alert.module';
import { CronModule } from '../cron/cron.module';
import { BackupService } from './backup.service';

@Module({
  imports: [ConfigModule, AdminAlertModule, CronModule],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule {}
