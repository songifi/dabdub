import { Controller, Get, UseGuards, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { SkipResponseWrap } from '../common/decorators/skip-response-wrap.decorator';
import { MetricsGuard } from './metrics.guard';
import { register } from 'prom-client';

@Controller({ path: 'metrics', version: VERSION_NEUTRAL })
@UseGuards(MetricsGuard)
export class PrometheusMetricsController {
  @Get()
  @SkipResponseWrap()
  @ApiExcludeEndpoint()
  async index(): Promise<string> {
    return register.metrics();
  }
}

