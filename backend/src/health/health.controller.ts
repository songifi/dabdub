import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis.health';
import { StellarHealthIndicator } from './stellar.health';

/**
 * GET /health
 *
 * Used by load balancers, Kubernetes liveness/readiness probes, and
 * post-deploy smoke tests.
 *
 * Response shape (Terminus standard):
 * {
 *   "status": "ok" | "error",
 *   "info":    { "db": { "status": "up" }, "redis": { "status": "up" }, "stellar": { "status": "up" } },
 *   "error":   {},           // populated only when a check fails
 *   "details": { ... }       // merged info + error
 * }
 *
 * HTTP 200 → all checks passed.
 * HTTP 503 → one or more checks failed (partial results are still returned).
 */
@ApiTags('health')
@ApiBearerAuth()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly stellar: StellarHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Service health check',
    description:
      'Returns per-component status for database, Redis, and the Stellar RPC node. ' +
      'Returns HTTP 200 when all are healthy, HTTP 503 when any component is down.',
  })
  @ApiResponse({ status: 200, description: 'All components healthy' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiResponse({ status: 503, description: 'One or more components degraded' })
  check() {
    return this.health.check([
      () => this.db.pingCheck('db'),
      () => this.redis.pingCheck('redis'),
      () => this.stellar.pingCheck('stellar'),
    ]);
  }
}
