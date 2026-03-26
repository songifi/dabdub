import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { RolesGuard } from '../rbac/guards/roles.guard';
import { Roles } from '../rbac/decorators/roles.decorator';
import { Role } from '../rbac/rbac.types';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/audit-logs')
@UseGuards(RolesGuard)
@Roles(Role.Admin, Role.SuperAdmin)
export class AuditLogsController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'List audit logs (paginated, filterable)' })
  findAll(@Query() query: QueryAuditLogDto) {
    return this.auditService.findAll(query);
  }
}
