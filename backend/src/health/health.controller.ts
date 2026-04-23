import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
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
