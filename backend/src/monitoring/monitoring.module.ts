import { Module } from '@nestjs/common';
import { QueueMetricsService } from './queue-metrics.service';
import { MetricsController } from './metrics.controller';

@Module({
  controllers: [MetricsController],
  providers: [QueueMetricsService],
  exports: [QueueMetricsService],
})
export class MonitoringModule {}
