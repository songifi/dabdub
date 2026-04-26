import { Module } from '@nestjs/common';
import { PrometheusModule as WillsotoPrometheusModule } from '@willsoto/nestjs-prometheus';
import { MetricsService } from './metrics.service';
import { PrometheusMetricsController } from './prometheus.controller';

@Module({
  imports: [
    WillsotoPrometheusModule.register({
      defaultMetrics: {
        enabled: true,
      },
    }),
  ],
  controllers: [PrometheusMetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class PrometheusModule {}

