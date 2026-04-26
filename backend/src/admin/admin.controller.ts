import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  Headers,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AdminService } from './admin.service';
import { MerchantStatus, MerchantRole } from '../merchants/entities/merchant.entity';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(MerchantRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('merchants')
  @ApiOperation({ summary: 'List all merchants' })
  findAllMerchants(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.adminService.findAllMerchants(+page, +limit);
  }

  @Get('merchants/:id')
  @ApiOperation({ summary: 'Get merchant details' })
  findOneMerchant(@Param('id') id: string) {
    return this.adminService.findOneMerchant(id);
  }

  @Patch('merchants/:id/status')
  @ApiOperation({ summary: 'Update merchant status' })
  updateStatus(@Param('id') id: string, @Body('status') status: MerchantStatus) {
    return this.adminService.updateMerchantStatus(id, status);
  }

  @Patch('merchants/bulk/status')
  @ApiOperation({ summary: 'Bulk update merchant status' })
  bulkUpdateStatus(@Body('ids') ids: string[], @Body('status') status: MerchantStatus) {
    return this.adminService.bulkUpdateMerchantStatus(ids, status);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get global stats' })
  getStats() {
    return this.adminService.getGlobalStats();
  }

  @Get('fees')
  @ApiOperation({ summary: 'List all global fee configurations' })
  getFees() {
    return this.adminService.getGlobalFees();
  }

  @Patch('fees')
  @ApiOperation({ summary: 'Update a global fee rate' })
  updateFee(
    @Body() dto: { feeType: string; newRate: string; reason?: string },
    @Req() req: Request & { user: { id: string } },
  ) {
    return this.adminService.updateGlobalFee(
      dto.feeType as any,
      dto.newRate,
      req.user.id,
      dto.reason,
    );
  }

  // ── Geographic Distribution Analytics (#714) ───────────────────────────────

  @Get('analytics/geography')
  @ApiOperation({ summary: 'Get geographic distribution of merchants and payments' })
  getGeographicDistribution(@Query('sortBy') sortBy = 'volume') {
    return this.adminService.getGeographicDistribution(sortBy);
  }

  // ── Admin User Management with 2FA (#707) ──────────────────────────────────

  @Post('users')
  @ApiOperation({ summary: 'Create a new admin user (SUPERADMIN only)' })
  createAdmin(
    @Body() dto: { email: string; password: string; businessName: string },
    @Req() req: Request & { user: { id: string; role: MerchantRole } },
  ) {
    return this.adminService.createAdmin(
      dto.email,
      dto.password,
      dto.businessName,
      req.user.role,
    );
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete an admin user (SUPERADMIN only)' })
  deleteAdmin(
    @Param('id') id: string,
    @Req() req: Request & { user: { id: string; role: MerchantRole } },
  ) {
    return this.adminService.deleteAdmin(id, req.user.role);
  }

  @Post('users/:id/2fa/setup')
  @ApiOperation({ summary: 'Generate a TOTP secret for an admin user' })
  setupAdminTotp(@Param('id') id: string) {
    return this.adminService.setupAdminTotp(id);
  }

  @Post('users/:id/2fa/verify')
  @ApiOperation({ summary: 'Verify a TOTP token and enable 2FA for an admin user' })
  verifyAdminTotp(
    @Param('id') id: string,
    @Body('token') token: string,
  ) {
    return this.adminService.verifyAdminTotp(id, token);
  }

  @Patch('users/:id/allowed-ips')
  @ApiOperation({ summary: 'Update the IP allowlist for an admin user' })
  updateAdminAllowedIps(
    @Param('id') id: string,
    @Body('ips') ips: string[],
  ) {
    return this.adminService.updateAdminAllowedIps(id, ips);
  }

  // ── Sandbox Environment Management (#708) ──────────────────────────────────

  @Patch('merchants/:id/sandbox')
  @ApiOperation({ summary: 'Enable or disable sandbox mode for a merchant' })
  toggleSandboxMode(
    @Param('id') id: string,
    @Body('enabled') enabled: boolean,
  ) {
    return this.adminService.toggleSandboxMode(id, enabled);
  }

  @Post('merchants/:id/sandbox/reset')
  @ApiOperation({ summary: 'Delete all sandbox payment data for a merchant' })
  resetSandboxData(@Param('id') id: string) {
    return this.adminService.resetSandboxData(id);
  }

  // ── Audit Log Viewer ───────────────────────────────────────────────────────

  @Get('audit-log')
  @ApiOperation({ summary: 'Get paginated audit log with filtering' })
  async getAuditLogs(
    @Query() query: any,
    @Query() pagination: PaginationDto,
    @Res() res: Response,
    @Query('export') exportType?: string,
    @Headers('accept') accept?: string,
  ) {
    const exportCsv = exportType === 'csv' || accept === 'text/csv';
    const result = await this.adminService.getAuditLogs(query, pagination, exportCsv);
    if (exportCsv) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-log.csv"');
      res.send(result);
    } else {
      res.json(result);
    }
  }

  // ── Generic Soft/Hard Delete and Restore ───────────────────────────────────

  @Post(':entity/:id/restore')
  @ApiOperation({ summary: 'Restore a soft-deleted record' })
  restoreRecord(
    @Param('entity') entity: string,
    @Param('id') id: string,
  ) {
    return this.adminService.restoreRecord(entity, id);
  }

  @Delete(':entity/:id')
  @ApiOperation({ summary: 'Soft or hard delete a record' })
  deleteRecord(
    @Param('entity') entity: string,
    @Param('id') id: string,
    @Query('hard') hard: string,
    @Req() req: Request & { user: { id: string; role: MerchantRole } },
  ) {
    const isHard = hard === 'true';
    return this.adminService.deleteRecord(entity, id, isHard, req.user.role);
  }
}
