import { Injectable } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly paymentCreatedTotal: Counter<string>;
  readonly paymentSettledTotal: Counter<string>;
  readonly settlementFailedTotal: Counter<string>;
  readonly settlementDurationSeconds: Histogram<string>;

  readonly httpRequestsTotal: Counter<string>;
  readonly httpRequestDurationMs: Histogram<string>;

  constructor() {
    this.paymentCreatedTotal = new Counter({
      name: 'payment_created_total',
      help: 'Total number of payments created',
      labelNames: ['type'],
    });

    this.paymentSettledTotal = new Counter({
      name: 'payment_settled_total',
      help: 'Total number of payments successfully settled',
      labelNames: ['type'],
    });

    this.settlementFailedTotal = new Counter({
      name: 'settlement_failed_total',
      help: 'Total number of settlement failures',
      labelNames: ['type'],
    });

    this.settlementDurationSeconds = new Histogram({
      name: 'settlement_duration_seconds',
      help: 'Time spent processing settlements in seconds',
      labelNames: ['type'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30],
    });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
    });

    this.httpRequestDurationMs = new Histogram({
      name: 'http_request_duration_ms',
      help: 'HTTP request latency in milliseconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    });
  }

  incrementPaymentCreated(type: string): void {
    this.paymentCreatedTotal.inc({ type });
  }

  incrementPaymentSettled(type: string): void {
    this.paymentSettledTotal.inc({ type });
  }

  incrementSettlementFailed(type: string): void {
    this.settlementFailedTotal.inc({ type });
  }

  observeSettlementDuration(type: string, durationSeconds: number): void {
    this.settlementDurationSeconds.observe({ type }, durationSeconds);
  }

  recordHttpRequest(
    method: string,
    route: string,
    status: number | string,
    durationMs: number,
  ): void {
    const labels = { method, route, status: String(status) };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationMs.observe(labels, durationMs);
  }
}

