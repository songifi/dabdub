import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheService } from './cache.service';
import { AnalyticsCacheService } from './analytics-cache.service';

@Module({
  imports: [ConfigModule],
  providers: [CacheService, AnalyticsCacheService],
  exports: [CacheService, AnalyticsCacheService],
})
export class CacheModule {}
