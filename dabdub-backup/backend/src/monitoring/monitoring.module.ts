import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrometheusModule, makeHistogramProvider } from '@willsoto/nestjs-prometheus';
import { MetricsInterceptor } from '../common/interceptors/metrics.interceptor';
import { BlockchainMonitoringService } from './services/blockchain-monitoring.service';
import { MonitoringInitializerService } from './services/monitoring-initializer.service';
import { ChainCursorEntity } from '../database/entities/chain-cursor.entity';
import { WalletEntity } from '../database/entities/wallet.entity';
import { EVMTransactionEntity } from '../database/entities/evm-transaction.entity';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),
    TypeOrmModule.forFeature([ChainCursorEntity, WalletEntity, EVMTransactionEntity]),
  ],
  providers: [
    makeHistogramProvider({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'code'],
      buckets: [0.1, 0.3, 0.5, 1, 1.5, 2, 5],
    }),
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    BlockchainMonitoringService,
    MonitoringInitializerService,
  ],
  exports: [BlockchainMonitoringService],
})
export class MonitoringModule {}
