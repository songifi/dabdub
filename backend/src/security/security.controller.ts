import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SecurityService } from './security.service';
import type {
  SecurityOverviewDto,
  PaginatedLoginHistoryDto,
  PaginatedSecurityAlertsDto,
  PaginatedTrustedDevicesDto,
} from './dto/security.dto';

interface AuthenticatedRequest extends Request {
  user?: { id: string; username: string };
}

@ApiTags('security')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'security', version: '1' })
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  /**
   * GET /security/overview
   * Get comprehensive security overview (security score, verification status, alerts, etc.)
   */
  @Get('overview')
  @ApiOperation({ summary: 'Get security dashboard overview' })
  @ApiResponse({ status: 200, description: 'Security overview retrieved', type: SecurityOverviewDto })
  async getOverview(@Req() req: AuthenticatedRequest): Promise<SecurityOverviewDto> {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('Unauthorized');
    }
    return this.securityService.getOverview(userId);
  }

  /**
   * GET /security/login-history
   * Paginated login attempts (last 30 days)
   */
  @Get('login-history')
  @ApiOperation({ summary: 'Get paginated login history' })
  @ApiResponse({ status: 200, description: 'Login history retrieved' })
  async getLoginHistory(
    @Req() req: AuthenticatedRequest,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ): Promise<PaginatedLoginHistoryDto> {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('Unauthorized');
    }

    const result = await this.securityService.getLoginHistory(userId, page, limit);

    return {
      data: result.data,
      limit: result.limit,
      total: result.total,
      page: result.page,
      hasMore: (page * limit) < result.total,
    };
  }

  /**
   * GET /security/alerts
   * Unread security alerts
   */
  @Get('alerts')
  @ApiOperation({ summary: 'Get unread security alerts' })
  @ApiResponse({ status: 200, description: 'Security alerts retrieved' })
  async getAlerts(
    @Req() req: AuthenticatedRequest,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ): Promise<PaginatedSecurityAlertsDto> {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('Unauthorized');
    }

    const result = await this.securityService.getUnreadAlerts(userId, page, limit);

    return {
      data: result.data,
      limit: result.limit,
      total: result.total,
      page: result.page,
      hasMore: (page * limit) < result.total,
    };
  }

  /**
   * PATCH /security/alerts/:id/read
   * Mark alert as read
   */
  @Patch('alerts/:id/read')
  @ApiOperation({ summary: 'Mark security alert as read' })
  @ApiResponse({ status: 200, description: 'Alert marked as read' })
  async markAlertAsRead(
    @Req() req: AuthenticatedRequest,
    @Param('id') alertId: string,
  ): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('Unauthorized');
    }

    await this.securityService.markAlertAsRead(userId, alertId);
  }

  /**
   * GET /security/devices
   * List trusted devices
   */
  @Get('devices')
  @ApiOperation({ summary: 'Get trusted devices' })
  @ApiResponse({ status: 200, description: 'Trusted devices retrieved' })
  async getTrustedDevices(
    @Req() req: AuthenticatedRequest,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ): Promise<PaginatedTrustedDevicesDto> {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('Unauthorized');
    }

    const result = await this.securityService.getTrustedDevices(userId, page, limit);

    return {
      data: result.data,
      limit: result.limit,
      total: result.total,
      page: result.page,
      hasMore: (page * limit) < result.total,
    };
  }

  /**
   * DELETE /security/devices/:id
   * Revoke a trusted device
   */
  @Delete('devices/:id')
  @ApiOperation({ summary: 'Revoke trusted device' })
  @ApiResponse({ status: 200, description: 'Device revoked' })
  async revokeTrustedDevice(
    @Req() req: AuthenticatedRequest,
    @Param('id') deviceId: string,
  ): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('Unauthorized');
    }

    await this.securityService.revokeTrustedDevice(userId, deviceId);
  }
}
