import { Controller, Get, UseGuards, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { register } from 'prom-client';
import { SkipResponseWrap } from '../common/decorators/skip-response-wrap.decorator';
import { MetricsGuard } from './metrics.guard';
import { MetricsService } from './metrics.service';

@Controller({ path: 'metrics', version: VERSION_NEUTRAL })
@UseGuards(MetricsGuard)
export class PrometheusMetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @SkipResponseWrap()
  @ApiExcludeEndpoint()
  async index(): Promise<string> {
    const [defaults, app] = await Promise.all([register.metrics(), this.metricsService.getAppMetricsText()]);
    const appTrim = app.trim();
    return appTrim ? `${defaults}\n\n${app}` : defaults;
  }
}

