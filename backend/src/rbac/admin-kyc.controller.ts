import { Controller, Patch, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from './decorators/roles.decorator';
import { Permissions } from './decorators/permissions.decorator';
import { Permission, Role } from './rbac.types';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/kyc')
@UseGuards(RolesGuard, PermissionsGuard)
export class AdminKycController {
  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a KYC request (requires kyc.review)' })
  @Roles(Role.Admin, Role.SuperAdmin)
  @Permissions(Permission.KycReview)
  approve(@Param('id') id: string): { ok: true; id: string } {
    // This route exists for RBAC enforcement; real KYC logic can replace it later.
    return { ok: true, id };
  }
}

