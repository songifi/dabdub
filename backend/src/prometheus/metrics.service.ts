import { Injectable } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly paymentCreatedTotal: Counter<string>;
  readonly paymentSettledTotal: Counter<string>;
  readonly settlementFailedTotal: Counter<string>;
  readonly settlementDurationSeconds: Histogram<string>;

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
}

