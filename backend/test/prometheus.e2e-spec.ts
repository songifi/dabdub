import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrometheusModule } from '../src/prometheus/prometheus.module';
import { MetricsService } from '../src/prometheus/metrics.service';
import { register } from 'prom-client';

describe('Prometheus /metrics (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrometheusModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    register.clear();
  });

  it('GET /metrics should return 200 and Prometheus text format from internal IP', async () => {
    const res = await request(app.getHttpServer())
      .get('/metrics')
      .set('X-Forwarded-For', '127.0.0.1')
      .expect(200);

    expect(res.text).toContain('# HELP');
    expect(res.headers['content-type']).toMatch(/text\/plain/);
  });

  it('GET /metrics should return 403 from public IP', async () => {
    await request(app.getHttpServer())
      .get('/metrics')
      .set('X-Forwarded-For', '8.8.8.8')
      .expect(403);
  });

  it('custom counters should be present in metrics output', async () => {
    const metricsService = app.get(MetricsService);
    metricsService.incrementPaymentCreated('deposit');
    metricsService.incrementPaymentSettled('withdrawal');
    metricsService.incrementSettlementFailed('withdrawal');
    metricsService.observeSettlementDuration('withdrawal', 0.5);

    const res = await request(app.getHttpServer())
      .get('/metrics')
      .set('X-Forwarded-For', '127.0.0.1')
      .expect(200);

    expect(res.text).toContain('payment_created_total');
    expect(res.text).toContain('payment_settled_total');
    expect(res.text).toContain('settlement_failed_total');
    expect(res.text).toContain('settlement_duration_seconds');
  });

  it('http_requests_total should be present and incremented after recordHttpRequest', async () => {
    const metricsService = app.get(MetricsService);
    metricsService.recordHttpRequest('GET', '/api/v1/users', 200, 120);

    const res = await request(app.getHttpServer())
      .get('/metrics')
      .set('X-Forwarded-For', '127.0.0.1')
      .expect(200);

    expect(res.text).toContain('http_requests_total');
    expect(res.text).toContain('method="GET"');
    expect(res.text).toContain('route="/api/v1/users"');
    expect(res.text).toContain('status="200"');
  });

  it('http_request_duration_ms should be present and contain observed buckets', async () => {
    const metricsService = app.get(MetricsService);
    metricsService.recordHttpRequest('POST', '/api/v1/payments', 201, 350);

    const res = await request(app.getHttpServer())
      .get('/metrics')
      .set('X-Forwarded-For', '127.0.0.1')
      .expect(200);

    expect(res.text).toContain('http_request_duration_ms');
    expect(res.text).toContain('method="POST"');
    expect(res.text).toContain('route="/api/v1/payments"');
    expect(res.text).toContain('status="201"');
  });
});

