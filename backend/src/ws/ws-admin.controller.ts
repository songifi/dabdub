import { Controller, Get, UseGuards } from '@nestjs/common';
import { CheeseGateway } from './cheese.gateway';
import { Roles } from '../rbac/decorators/roles.decorator';
import { Role } from '../rbac/rbac.types';
import { RolesGuard } from '../rbac/guards/roles.guard';

@Controller({ path: 'admin/ws', version: '1' })
@UseGuards(RolesGuard)
@Roles(Role.Admin, Role.SuperAdmin)
export class WsAdminController {
  constructor(private readonly gateway: CheeseGateway) {}

  @Get('stats')
  getStats(): Promise<{ connectedUsers: number; totalSockets: number }> {
    return this.gateway.getStats();
  }
}
