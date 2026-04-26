import { Module } from '@nestjs/common';
import { PoolMonitorService } from './pool-monitor.service';

@Module({
  providers: [PoolMonitorService],
})
export class DatabaseModule {}
