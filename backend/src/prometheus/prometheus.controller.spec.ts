import { Test, TestingModule } from '@nestjs/testing';
import { PrometheusMetricsController } from './prometheus.controller';
import { register } from 'prom-client';

describe('PrometheusMetricsController', () => {
  let controller: PrometheusMetricsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrometheusMetricsController],
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

