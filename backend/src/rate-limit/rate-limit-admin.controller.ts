import {
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiParam,
} from '@nestjs/swagger';
import { IpBlockService } from './ip-block.service';
import { Roles } from '../rbac/decorators/roles.decorator';
import { Role } from '../rbac/rbac.types';
import { RolesGuard } from '../rbac/guards/roles.guard';
import { BlockedIpsResponseDto, UnblockIpResponseDto } from './dto/rate-limit-admin-response.dto';

@ApiTags('admin')
@ApiBearerAuth('bearer')
@Controller('admin/rate-limits')
@UseGuards(RolesGuard)
@Roles(Role.Admin, Role.SuperAdmin)
export class RateLimitAdminController {
  constructor(private readonly ipBlockService: IpBlockService) {}

  @Get('blocked-ips')
  @ApiOperation({ summary: 'List all currently blocked IP addresses' })
  @ApiOkResponse({ type: BlockedIpsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient role' })
  async listBlockedIps(): Promise<{ blockedIps: string[] }> {
    const blockedIps = await this.ipBlockService.listBlockedIps();
    return { blockedIps };
  }

  @Delete('blocked-ips/:ip')
  @ApiOperation({ summary: 'Unblock an IP address and clear its hit counter' })
  @ApiParam({ name: 'ip', description: 'IPv4 or IPv6 address to unblock', example: '1.2.3.4' })
  @ApiOkResponse({ type: UnblockIpResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient role' })
  @ApiNotFoundResponse({ description: 'IP is not currently blocked' })
  async unblockIp(@Param('ip') ip: string): Promise<{ message: string }> {
    const isBlocked = await this.ipBlockService.isBlocked(ip);
    if (!isBlocked) {
      throw new NotFoundException(`IP ${ip} is not currently blocked`);
    }

    await this.ipBlockService.unblockIp(ip);
    return { message: `IP ${ip} has been unblocked` };
  }
}
