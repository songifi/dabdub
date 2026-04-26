import { Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { PrometheusModule } from '../prometheus/prometheus.module';

@Module({
  imports: [PrometheusModule],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
