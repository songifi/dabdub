import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule, InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { FileUpload } from './entities/file-upload.entity';
import { UploadService, UPLOAD_QUEUE, CLEANUP_JOB } from './upload.service';
import { UploadController } from './upload.controller';
import { UploadProcessor } from './upload.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([FileUpload]),
    BullModule.registerQueue({
      name: UPLOAD_QUEUE,
      defaultJobOptions: { removeOnComplete: true },
    }),
  ],
  providers: [UploadService, UploadProcessor],
  controllers: [UploadController],
  exports: [UploadService],
})
export class UploadModule implements OnModuleInit {
  constructor(@InjectQueue(UPLOAD_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      CLEANUP_JOB,
      {},
      { repeat: { cron: '0 * * * *' }, jobId: 'cleanup-unconfirmed-cron' },
    );
  }
}
