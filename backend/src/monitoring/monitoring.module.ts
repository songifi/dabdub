import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  PrometheusModule,
  makeHistogramProvider,
  makeCounterProvider,
  makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';
import { MetricsInterceptor } from '../common/interceptors/metrics.interceptor';
import { MetricsService } from './metrics.service';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),
  ],
  providers: [
    MetricsService,
    makeHistogramProvider({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'code'],
      buckets: [0.1, 0.3, 0.5, 1, 1.5, 2, 5],
    }),
    makeCounterProvider({
      name: 'payment_success_total',
      help: 'Total number of successful payments',
      labelNames: ['asset'],
    }),
    makeCounterProvider({
      name: 'payment_amount_total',
      help: 'Total amount of payments processed',
      labelNames: ['asset'],
    }),
    makeGaugeProvider({
      name: 'active_merchants',
      help: 'Number of currently active merchants',
    }),
    makeHistogramProvider({
      name: 'stellar_transaction_duration',
      help: 'Duration of Stellar transactions',
      buckets: [1, 2, 5, 10, 30, 60],
    }),
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
  exports: [MetricsService],
})
export class MonitoringModule { }
