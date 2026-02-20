import {
  Controller,
  Get,
  HttpStatus,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { HealthCheck, HealthCheckResult } from '@nestjs/terminus';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthService } from '../services/health.service';
import { JwtGuard } from '../../auth/guards/jwt.guard';

@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Basic health check',
    description: 'Returns the health status of the application and database',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Application is healthy',
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'Application is not healthy',
  })
  async check(): Promise<HealthCheckResult> {
    return this.healthService.check();
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness probe',
    description:
      'Checks if the application is ready to handle requests (DB, dependencies)',
  })
  async checkReadiness(): Promise<HealthCheckResult> {
    return this.healthService.checkReadiness();
  }

  @Get('live')
  @HealthCheck()
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Checks if the application is alive/responsive',
  })
  async checkLiveness(): Promise<HealthCheckResult> {
    return this.healthService.checkLiveness();
  }

  @Get('detailed')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(5000) // 5 seconds cache
  @HealthCheck()
  @ApiOperation({
    summary: 'Detailed health check',
    description:
      'Performs comprehensive system checks (Auth required, Cached 5s)',
  })
  async checkDetailed(): Promise<HealthCheckResult> {
    return this.healthService.checkDetailed();
  }

  @Get('version')
  @ApiOperation({
    summary: 'Version information',
    description: 'Returns the current version of the application',
  })
  getVersion() {
    return {
      version: process.env.npm_package_version || '0.0.1',
      environment: process.env.NODE_ENV || 'development',
      gitCommit: process.env.GIT_COMMIT || 'unknown',
    };
  }
}
