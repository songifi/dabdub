import { Controller, Get, HttpStatus, HttpException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  HttpHealthIndicator,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private http: HttpHealthIndicator,
    private config: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness — always 200 while process is alive' })
  liveness() {
    return { status: 'ok' };
  }

  @Get('admin')
  @ApiOperation({ 
    summary: 'Admin health check - comprehensive system status',
    description: 'Returns detailed health status of all system components for admin visibility'
  })
  @ApiResponse({
    status: 200,
    description: 'System is healthy or degraded',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'degraded', 'down'] },
        timestamp: { type: 'string', format: 'date-time' },
        components: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['ok', 'degraded', 'down'] },
                latency: { type: 'number', description: 'Response time in milliseconds' }
              }
            },
            stellar: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['ok', 'degraded', 'down'] },
                latency: { type: 'number', description: 'Response time in milliseconds' }
              }
            },
            partnerApi: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['ok', 'degraded', 'down'] },
                latency: { type: 'number', description: 'Response time in milliseconds' }
              }
            },
            redis: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['ok', 'degraded', 'down'] },
                latency: { type: 'number', description: 'Response time in milliseconds' }
              }
            },
            queue: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['ok', 'degraded', 'down'] },
                latency: { type: 'number', description: 'Response time in milliseconds' }
              }
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 503,
    description: 'One or more critical components are down',
  })
  async adminHealth() {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    
    // Define critical components that cause 503 if down
    const criticalComponents = ['database', 'stellar'];
    
    // Run all health checks in parallel for performance
    const healthChecks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkStellar(),
      this.checkPartnerApi(),
      this.checkRedis(),
      this.checkQueue(),
    ]);

    const components = {
      database: this.getResultFromSettled(healthChecks[0]),
      stellar: this.getResultFromSettled(healthChecks[1]),
      partnerApi: this.getResultFromSettled(healthChecks[2]),
      redis: this.getResultFromSettled(healthChecks[3]),
      queue: this.getResultFromSettled(healthChecks[4]),
    };

    // Determine overall system status
    const componentStatuses = Object.values(components).map(c => c.status);
    const hasCriticalDown = criticalComponents.some(
      comp => components[comp].status === 'down'
    );
    const hasAnyDown = componentStatuses.includes('down');
    const hasAnyDegraded = componentStatuses.includes('degraded');

    let overallStatus: 'healthy' | 'degraded' | 'down';
    if (hasCriticalDown) {
      overallStatus = 'down';
    } else if (hasAnyDown || hasAnyDegraded) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const response = {
      status: overallStatus,
      timestamp,
      components,
      responseTime: Date.now() - startTime,
    };

    // Return 503 if critical components are down
    if (hasCriticalDown) {
      throw new HttpException(response, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return response;
  }

  private async checkDatabase(): Promise<{ status: string; latency: number }> {
    const startTime = Date.now();
    try {
      await this.db.pingCheck('database');
      const latency = Date.now() - startTime;
      return {
        status: latency > 1000 ? 'degraded' : 'ok',
        latency,
      };
    } catch (error) {
      return {
        status: 'down',
        latency: Date.now() - startTime,
      };
    }
  }

  private async checkStellar(): Promise<{ status: string; latency: number }> {
    const startTime = Date.now();
    try {
      const horizonUrl = this.config.get(
        'STELLAR_HORIZON_URL',
        'https://horizon-testnet.stellar.org',
      );
      await this.http.pingCheck('stellar', `${horizonUrl}/`);
      const latency = Date.now() - startTime;
      return {
        status: latency > 2000 ? 'degraded' : 'ok',
        latency,
      };
    } catch (error) {
      return {
        status: 'down',
        latency: Date.now() - startTime,
      };
    }
  }

  private async checkPartnerApi(): Promise<{ status: string; latency: number }> {
    const startTime = Date.now();
    try {
      // Check if partner API URL is configured
      const partnerApiUrl = this.config.get('PARTNER_API_URL');
      if (!partnerApiUrl) {
        return {
          status: 'ok', // Not configured, so not critical
          latency: 0,
        };
      }

      await this.http.pingCheck('partnerApi', `${partnerApiUrl}/health`);
      const latency = Date.now() - startTime;
      return {
        status: latency > 3000 ? 'degraded' : 'ok',
        latency,
      };
    } catch (error) {
      return {
        status: 'degraded', // Partner API down is degraded, not critical
        latency: Date.now() - startTime,
      };
    }
  }

  private async checkRedis(): Promise<{ status: string; latency: number }> {
    const startTime = Date.now();
    try {
      // Check if Redis is configured
      const redisUrl = this.config.get('REDIS_URL');
      if (!redisUrl) {
        return {
          status: 'ok', // Not configured, so not critical
          latency: 0,
        };
      }

      // For now, return ok since Redis isn't implemented yet
      // TODO: Implement actual Redis health check when Redis is added
      return {
        status: 'ok',
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'degraded',
        latency: Date.now() - startTime,
      };
    }
  }

  private async checkQueue(): Promise<{ status: string; latency: number }> {
    const startTime = Date.now();
    try {
      // Check if queue system is configured
      const queueUrl = this.config.get('QUEUE_URL');
      if (!queueUrl) {
        return {
          status: 'ok', // Not configured, so not critical
          latency: 0,
        };
      }

      // For now, return ok since queue isn't implemented yet
      // TODO: Implement actual queue health check when queue system is added
      return {
        status: 'ok',
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'degraded',
        latency: Date.now() - startTime,
      };
    }
  }

  private getResultFromSettled(
    result: PromiseSettledResult<{ status: string; latency: number }>
  ): { status: string; latency: number } {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        status: 'down',
        latency: 0,
      };
    }
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness — checks DB and Stellar' })
  readiness() {
    const horizonUrl = this.config.get(
      'STELLAR_HORIZON_URL',
      'https://horizon-testnet.stellar.org',
    );

    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.http.pingCheck('stellar', `${horizonUrl}/`),
    ]);
  }
}