import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Audit, AuditInterceptor } from '../audit/audit.interceptor';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import { Roles } from '../rbac/decorators/roles.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RolesGuard } from '../rbac/guards/roles.guard';
import { Permission, Role } from '../rbac/rbac.types';
import { ComplianceDashboardService } from './compliance.service';
import { CreateSarDto } from './dto/create-sar.dto';
import { QueryHighRiskUsersDto } from './dto/query-high-risk-users.dto';
import { QuerySarsDto } from './dto/query-sars.dto';

type AuthReq = Request & { user: { id: string } };

@ApiTags('admin / compliance')
@ApiBearerAuth()
@Controller({ path: 'admin/compliance', version: '1' })
@UseGuards(RolesGuard, PermissionsGuard)
@UseInterceptors(AuditInterceptor)
export class ComplianceController {
  constructor(
    private readonly complianceService: ComplianceDashboardService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get compliance dashboard summary' })
  @Roles(Role.Admin, Role.SuperAdmin)
  @Permissions(Permission.ComplianceReview)
  getDashboard() {
    return this.complianceService.getSummary();
  }

  @Get('high-risk')
  @ApiOperation({ summary: 'List high-risk users' })
  @Roles(Role.Admin, Role.SuperAdmin)
  @Permissions(Permission.ComplianceReview)
  getHighRiskUsers(@Query() query: QueryHighRiskUsersDto) {
    return this.complianceService.getHighRiskUsers(query.page, query.limit);
  }

  @Get('users/:id/patterns')
  @ApiOperation({ summary: 'Get transaction patterns for a user' })
  @Roles(Role.Admin, Role.SuperAdmin)
  @Permissions(Permission.ComplianceReview)
  getTransactionPatterns(@Param('id') id: string) {
    return this.complianceService.getTransactionPatterns(id);
  }

  @Post('sar')
  @ApiOperation({ summary: 'Create a suspicious activity report draft' })
  @Roles(Role.Admin, Role.SuperAdmin)
  @Permissions(Permission.ComplianceReview)
  @Audit({ action: 'compliance.sar.create', resourceType: 'sar' })
  createSar(@Req() req: AuthReq, @Body() dto: CreateSarDto) {
    return this.complianceService.createSarDraft(req.user.id, dto);
  }

  @Get('sar')
  @ApiOperation({ summary: 'List suspicious activity reports' })
  @Roles(Role.Admin, Role.SuperAdmin)
  @Permissions(Permission.ComplianceReview)
  listSars(@Query() query: QuerySarsDto) {
    return this.complianceService.listSars(query);
  }

  @Patch('sar/:id/submit')
  @ApiOperation({ summary: 'Submit a suspicious activity report' })
  @Roles(Role.Admin, Role.SuperAdmin)
  @Permissions(Permission.ComplianceReview)
  @Audit({
    action: 'compliance.sar.submit',
    resourceType: 'sar',
    resourceIdParam: 'id',
  })
  submitSar(@Param('id') id: string, @Req() req: AuthReq) {
    return this.complianceService.submitSar(id, req.user.id);
  }
}
