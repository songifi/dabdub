import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { CheeseGateway } from './cheese.gateway';
import { Roles } from '../rbac/decorators/roles.decorator';
import { Role } from '../rbac/rbac.types';
import { RolesGuard } from '../rbac/guards/roles.guard';
import { WsStatsResponseDto } from './dto/ws-stats-response.dto';

@ApiTags('admin')
@ApiBearerAuth('bearer')
@Controller('admin/ws')
@UseGuards(RolesGuard)
@Roles(Role.Admin, Role.SuperAdmin)
export class WsAdminController {
  constructor(private readonly gateway: CheeseGateway) {}

  @Get('stats')
  @ApiOperation({ summary: 'WebSocket connection statistics' })
  @ApiOkResponse({ type: WsStatsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient role' })
  getStats(): Promise<{ connectedUsers: number; totalSockets: number }> {
    return this.gateway.getStats();
  }
}
