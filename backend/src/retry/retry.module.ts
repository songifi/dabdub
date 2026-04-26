import { Module } from '@nestjs/common';
import { RetryConfigService } from './retry-config.service';
import { RetryQueueService } from './retry-queue.service';

@Module({
  providers: [RetryConfigService, RetryQueueService],
  exports: [RetryConfigService, RetryQueueService],
})
export class RetryModule {}
