import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { Roles } from './decorators/roles.decorator';
import { Role, Permission } from './rbac.types';
import { RolesGuard } from './guards/roles.guard';
import { GrantPermissionDto } from './dto/grant-permission.dto';
import { RbacService } from './rbac.service';
import { PermissionsGuard } from './guards/permissions.guard';
import { OkResponseDto, AdminPermissionsListResponseDto } from './dto/rbac-api-response.dto';

interface RequestWithUser {
  user?: { id: string; role?: Role };
}

@ApiTags('admin')
@ApiBearerAuth('bearer')
@Controller('admin/permissions')
@UseGuards(RolesGuard)
@Roles(Role.SuperAdmin)
export class AdminPermissionsController {
  constructor(
    private readonly rbac: RbacService,
    private readonly permissionsGuard: PermissionsGuard,
  ) {}

  @Post(':adminId')
  @ApiOperation({ summary: 'Grant an admin permission (SuperAdmin only)' })
  @ApiOkResponse({ type: OkResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Caller is not SuperAdmin' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async grant(
    @Param('adminId') adminId: string,
    @Body() dto: GrantPermissionDto,
    @Req() req: RequestWithUser,
  ): Promise<{ ok: true }> {
    const grantedBy = req.user!.id;
    await this.rbac.grant(adminId, dto.permission, grantedBy);
    await this.permissionsGuard.invalidate(adminId);
    return { ok: true };
  }

  @Delete(':adminId/:permission')
  @ApiOperation({ summary: 'Revoke an admin permission (SuperAdmin only)' })
  @ApiOkResponse({ type: OkResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Caller is not SuperAdmin' })
  async revoke(
    @Param('adminId') adminId: string,
    @Param('permission') permission: Permission,
  ): Promise<{ ok: true }> {
    await this.rbac.revoke(adminId, permission);
    await this.permissionsGuard.invalidate(adminId);
    return { ok: true };
  }

  @Get(':adminId')
  @ApiOperation({ summary: 'List permissions for an admin' })
  @ApiOkResponse({ type: AdminPermissionsListResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Caller is not SuperAdmin' })
  async list(@Param('adminId') adminId: string): Promise<{ permissions: Permission[] }> {
    const rows = await this.rbac.list(adminId);
    return { permissions: rows.map((r) => r.permission) };
  }
}

