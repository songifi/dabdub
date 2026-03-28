import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule, InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { ReportJob } from './entities/report-job.entity';
import { ReportsService, REPORT_QUEUE, CLEANUP_REPORT_JOB } from './reports.service';
import { ReportsController } from './reports.controller';
import { ReportsProcessor } from './reports.processor';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReportJob]),
    BullModule.registerQueue({
      name: REPORT_QUEUE,
      defaultJobOptions: { removeOnComplete: true },
    }),
    EmailModule,
  ],
  providers: [ReportsService, ReportsProcessor],
  controllers: [ReportsController],
  exports: [ReportsService],
})
export class ReportsModule implements OnModuleInit {
  constructor(@InjectQueue(REPORT_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    // Daily cron: clean up expired report jobs + R2 objects
    await this.queue.add(
      CLEANUP_REPORT_JOB,
      {},
      {
        repeat: { cron: '0 2 * * *' }, // 02:00 UTC daily
        jobId: 'cleanup-expired-reports-cron',
      },
    );
  }
}
