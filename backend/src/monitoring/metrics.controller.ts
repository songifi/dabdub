import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { QueueMetricsService } from './queue-metrics.service';

@Controller()
export class MetricsController {
  constructor(private readonly queueMetrics: QueueMetricsService) {}

  @Public()
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  metrics(): Promise<string> {
    return this.queueMetrics.getMetrics();
  }
}
