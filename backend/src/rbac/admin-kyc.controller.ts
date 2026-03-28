import { Controller, Patch, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from './decorators/roles.decorator';
import { Permissions } from './decorators/permissions.decorator';
import { Permission, Role } from './rbac.types';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { AuditInterceptor, Audit } from '../audit/audit.interceptor';

@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin/kyc', version: '1' })
@UseGuards(RolesGuard, PermissionsGuard)
@UseInterceptors(AuditInterceptor)
export class AdminKycController {
  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a KYC request (requires kyc.review)' })
  @Roles(Role.Admin, Role.SuperAdmin)
  @Permissions(Permission.KycReview)
  @Audit({ action: 'kyc.approved', resourceType: 'kyc', resourceIdParam: 'id' })
  approve(@Param('id') id: string): { ok: true; id: string } {
    return { ok: true, id };
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a KYC request (requires kyc.review)' })
  @Roles(Role.Admin, Role.SuperAdmin)
  @Permissions(Permission.KycReview)
  @Audit({ action: 'kyc.rejected', resourceType: 'kyc', resourceIdParam: 'id' })
  reject(@Param('id') id: string): { ok: true; id: string } {
    return { ok: true, id };
  }
}
