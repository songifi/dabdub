import {
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { IpBlockService } from './ip-block.service';

@ApiTags('admin / rate-limits')
@ApiBearerAuth()
@Controller('admin/rate-limits')
export class RateLimitAdminController {
  constructor(private readonly ipBlockService: IpBlockService) {}

  @Get('blocked-ips')
  @ApiOperation({ summary: 'List all currently blocked IP addresses' })
  @ApiResponse({ status: 200, schema: { properties: { blockedIps: { type: 'array', items: { type: 'string' }, example: ['1.2.3.4'] } } } })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async listBlockedIps(): Promise<{ blockedIps: string[] }> {
    const blockedIps = await this.ipBlockService.listBlockedIps();
    return { blockedIps };
  }

  @Delete('blocked-ips/:ip')
  @ApiOperation({ summary: 'Unblock an IP address and clear its hit counter' })
  @ApiParam({ name: 'ip', description: 'IPv4 or IPv6 address to unblock', example: '1.2.3.4' })
  @ApiResponse({ status: 200, schema: { properties: { message: { type: 'string', example: 'IP 1.2.3.4 has been unblocked' } } } })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'IP is not currently blocked' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async unblockIp(@Param('ip') ip: string): Promise<{ message: string }> {
    const isBlocked = await this.ipBlockService.isBlocked(ip);
    if (!isBlocked) {
      throw new NotFoundException(`IP ${ip} is not currently blocked`);
    }

    await this.ipBlockService.unblockIp(ip);
    return { message: `IP ${ip} has been unblocked` };
  }
}
