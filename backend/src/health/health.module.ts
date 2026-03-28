import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './redis.health';
import { StellarHealthIndicator } from './stellar.health';
import { QueueModule } from '../queue/queue.module';

/**
 * HealthModule wires together all health indicators and exposes GET /health.
 *
 * Config tokens (redisConfig, stellarConfig) are globally available because
 * AppConfigModule sets isGlobal: true — no need to re-import AppConfigModule here.
 *
 * TypeOrmModule is imported so TypeOrmHealthIndicator can access the data source.
 */
@Module({
  imports: [
    TerminusModule,
    // Required for TypeOrmHealthIndicator to resolve the active DataSource.
    TypeOrmModule,
    QueueModule,
  ],
  controllers: [HealthController],
  providers: [RedisHealthIndicator, StellarHealthIndicator],
})
export class HealthModule {}
