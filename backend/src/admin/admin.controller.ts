import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { ReceiptService } from '../receipt/receipt.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminRole } from './entities/admin.entity';
import { Request } from 'express';
import { AuditInterceptor, Audit } from '../audit/audit.interceptor';
import { ReferralAnalyticsService } from '../referrals/referral-analytics.service';
import { FunnelStatsDto, TopReferrersDto, CohortComparisonDto, RewardSpendDto, UserReferralStatsDto } from '../referrals/dto/referral-analytics.dto';
import { OffRampService } from '../offramp/offramp.service';
import { AdminOffRampQueryDto, OffRampResponseDto } from '../offramp/dto/offramp.dto';
import { GeoService } from '../geo/geo.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@UseInterceptors(AuditInterceptor)
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly receiptService: ReceiptService,
    private readonly referralAnalyticsService: ReferralAnalyticsService,
    private readonly offRampService: OffRampService,
    private readonly geoService: GeoService,
  ) {}

  @Get('users')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'List all users with pagination and filtering' })
  async listUsers(@Query() query: any) {
    return this.adminService.findAllUsers(query);
  }

  @Get('referrals/analytics')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'Referral funnel stats + top referrers + reward spend' })
  async getReferralAnalytics(): Promise<FunnelStatsDto> {
    return this.referralAnalyticsService.getFunnelStats();
  }

  @Get('referrals/cohort')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'Referred vs organic cohort comparison' })
  async getReferralCohort(): Promise<CohortComparisonDto> {
    return this.referralAnalyticsService.getCohortComparison();
  }

  @Get('referrals/users/:userId')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'Individual user referral performance' })
  async getUserReferralStats(@Param('userId') userId: string): Promise<UserReferralStatsDto> {
    return this.referralAnalyticsService.getUserReferralStats(userId);
  }

  @Get('users/:id')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get full user profile' })
  async getUserProfile(@Param('id') id: string) {
    return this.adminService.findUserById(id);
  }

  @Patch('users/:id/freeze')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @Audit({ action: 'user.freeze', resourceType: 'user', resourceIdParam: 'id' })
  @ApiOperation({ summary: 'Freeze user account' })
  async freezeUser(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    const adminId = req.user.id;
    return this.adminService.freezeUser(id, reason, adminId);
  }

  @Patch('users/:id/unfreeze')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @Audit({ action: 'user.unfreeze', resourceType: 'user', resourceIdParam: 'id' })
  @ApiOperation({ summary: 'Unfreeze user account' })
  async unfreezeUser(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user.id;
    return this.adminService.unfreezeUser(id, adminId);
  }

  // getStats() moved to dedicated /admin/analytics/dashboard endpoint


  @Get('transactions')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'List all transactions globally' })
  async listTransactions(@Query() query: any) {
    return this.adminService.findAllTransactions(query);
  }

  @Post('broadcast')
  @Roles(AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'Broadcast a message to users' })
  async broadcast(
    @Body() dto: { title: string; body: string; segment: string },
  ) {
    return this.adminService.broadcast(dto);
  }

  @Get('transactions/:id/receipt')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'Generate receipt for any transaction (admin)' })
  async getTransactionReceipt(@Param('id') id: string) {
    return this.receiptService.generateTransactionReceiptAdmin(id);
  }

  // ── Off-Ramp Admin ──────────────────────────────────────────────────────────

  @Get('offramps')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'List all off-ramp orders with optional filters' })
  async listOffRamps(@Query() query: AdminOffRampQueryDto) {
    return this.offRampService.adminList(query);
  }

  @Get('offramps/:id')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get a single off-ramp order by ID' })
  async getOffRamp(@Param('id') id: string): Promise<OffRampResponseDto> {
    return this.offRampService.adminGetById(id);
  }

  @Post('offramps/:id/refund')
  @Roles(AdminRole.SUPERADMIN)
  @Audit({ action: 'offramp.refund', resourceType: 'off_ramp', resourceIdParam: 'id' })
  @ApiOperation({ summary: 'Manually trigger USDC refund for a failed off-ramp order' })
  async refundOffRamp(@Param('id') id: string): Promise<OffRampResponseDto> {
    return this.offRampService.adminRefund(id);
  @Get('geo/stats')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Geo-blocked request counts by country in the last 24 hours',
  })
  async getGeoStats() {
    return this.geoService.getBlockedCountryStatsLast24h();
  }
}
