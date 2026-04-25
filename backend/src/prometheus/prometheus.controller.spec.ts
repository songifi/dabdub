import { Test, TestingModule } from '@nestjs/testing';
import { PrometheusMetricsController } from './prometheus.controller';
import { MetricsService } from './metrics.service';
import { Counter, register } from 'prom-client';

describe('PrometheusMetricsController', () => {
  let controller: PrometheusMetricsController;

  beforeEach(async () => {
    register.clear();
    new Counter({
      name: 'prometheus_controller_spec_metric',
      help: 'Ensures register.metrics() returns HELP lines in isolated tests',
      registers: [register],
    });
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrometheusMetricsController],
      providers: [MetricsService],
    }).compile();

    controller = module.get<PrometheusMetricsController>(PrometheusMetricsController);
  });

  afterEach(() => {
    register.clear();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return Prometheus-formatted metrics', async () => {
    const result = await controller.index();
    expect(typeof result).toBe('string');
    expect(result).toContain('# HELP');
  });
});

