import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ErrorMonitoringService } from './error-monitoring.service';
import { ErrorCode } from '../errors/error-codes.enum';

/**
 * Error Monitoring Controller
 * Provides endpoints for error monitoring and statistics
 * Note: In production, these endpoints should be protected with authentication
 */
@Controller('monitoring/errors')
export class ErrorMonitoringController {
  constructor(
    private readonly errorMonitoringService: ErrorMonitoringService,
  ) {}

  /**
   * Get error statistics
   */
  @Get('statistics')
  getStatistics(@Query('hours') hours?: string) {
    const timeRangeHours = hours ? parseInt(hours, 10) : 24;
    return this.errorMonitoringService.getStatistics(timeRangeHours);
  }

  /**
   * Get errors by error code
   */
  @Get('by-code')
  getErrorsByCode(@Query('code') code: string, @Query('limit') limit?: string) {
    const errorCode = code as ErrorCode;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.errorMonitoringService.getErrorsByCode(errorCode, limitNum);
  }

  /**
   * Clear error logs
   */
  @Get('clear')
  clearLogs() {
    this.errorMonitoringService.clearLogs();
    return { message: 'Error logs cleared' };
  }
}
