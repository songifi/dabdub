import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from '../../auth/guards/jwt.guard';
import { RequirePermissionGuard } from '../../auth/guards/require-permission.guard';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { SecurityEventService } from '../services/security-event.service';
import { IpBlockService } from '../services/ip-block.service';
import { BlockIpDto } from '../dto/security.dto';

@ApiTags('Security Management')
@Controller('api/v1/security')
@UseGuards(JwtGuard, RequirePermissionGuard)
@ApiBearerAuth()
export class SecurityController {
  constructor(
    private readonly eventService: SecurityEventService,
    private readonly ipBlockService: IpBlockService,
  ) {}

  @Get('events')
  @RequirePermission('risk:manage')
  @ApiOperation({ summary: 'Security event log' })
  async getEvents(@Query() query: any) {
    return this.eventService.getEvents(query);
  }

  @Get('events/summary')
  @RequirePermission('risk:manage')
  @ApiOperation({ summary: 'Security event summary' })
  async getSummary() {
    return this.eventService.getSummary();
  }

  @Get('ip-blocks')
  @RequirePermission('risk:manage')
  @ApiOperation({ summary: 'List all blocked IPs' })
  async listBlockedIps() {
    return this.ipBlockService.listBlockedIps();
  }

  @Post('ip-blocks')
  @RequirePermission('risk:manage')
  @ApiOperation({ summary: 'Block an IP/CIDR' })
  async blockIp(@Body() dto: BlockIpDto, @Req() req: any) {
    return this.ipBlockService.blockIp(dto, req.user.id);
  }

  @Delete('ip-blocks/:id')
  @RequirePermission('risk:manage')
  @ApiOperation({ summary: 'Unblock IP' })
  async unblockIp(@Param('id') id: string, @Req() req: any) {
    return this.ipBlockService.unblockIp(id, req.user.id);
  }
}
