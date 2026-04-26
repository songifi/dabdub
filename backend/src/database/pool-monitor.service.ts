import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Monitors the TypeORM connection pool and logs a warning when the pool
 * is exhausted (all connections in use). Runs a periodic check every 30s.
 */
@Injectable()
export class PoolMonitorService implements OnModuleInit {
  private readonly logger = new Logger(PoolMonitorService.name);
  private intervalRef: NodeJS.Timeout | null = null;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  onModuleInit() {
    this.intervalRef = setInterval(() => this.checkPool(), 30_000);
  }

  onModuleDestroy() {
    if (this.intervalRef) clearInterval(this.intervalRef);
  }

  private checkPool() {
    // TypeORM uses `pg` driver; the underlying pool is accessible via driver
    const pool = (this.dataSource.driver as any)?.master;
    if (!pool) return;

    const total: number = pool.totalCount ?? 0;
    const idle: number = pool.idleCount ?? 0;
    const waiting: number = pool.waitingCount ?? 0;
    const active = total - idle;

    if (waiting > 0) {
      this.logger.warn(
        `[DB Pool] Pool exhausted — total=${total} active=${active} idle=${idle} waiting=${waiting}`,
      );
    }
  }
}
