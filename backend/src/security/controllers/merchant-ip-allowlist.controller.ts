import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from '../../auth/guards/jwt.guard';
import { RequirePermissionGuard } from '../../auth/guards/require-permission.guard';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { IpAllowlistService } from '../services/ip-allowlist.service';
import { AddIpAllowlistDto, ToggleEnforcementDto } from '../dto/security.dto';

@ApiTags('Merchant IP Allowlist')
@Controller('api/v1/merchants/:id/ip-allowlist')
@UseGuards(JwtGuard, RequirePermissionGuard)
@ApiBearerAuth()
export class MerchantIpAllowlistController {
  constructor(private readonly ipAllowlistService: IpAllowlistService) {}

  @Get()
  @RequirePermission('merchants:read')
  @ApiOperation({ summary: 'Get merchant IP allowlist' })
  async getAllowlist(@Param('id') merchantId: string) {
    return this.ipAllowlistService.getAllowlist(merchantId);
  }

  @Post()
  @RequirePermission('merchants:write')
  @ApiOperation({ summary: 'Add IP/CIDR to allowlist' })
  async addIp(
    @Param('id') merchantId: string,
    @Body() dto: AddIpAllowlistDto,
    @Req() req: any,
  ) {
    return this.ipAllowlistService.addIp(merchantId, dto, req.user.id);
  }

  @Delete(':entryId')
  @RequirePermission('merchants:write')
  @ApiOperation({ summary: 'Remove IP from allowlist' })
  async removeIp(
    @Param('id') merchantId: string,
    @Param('entryId') entryId: string,
    @Req() req: any,
  ) {
    return this.ipAllowlistService.removeIp(merchantId, entryId, req.user.id);
  }

  @Patch('enforcement')
  @RequirePermission('merchants:write')
  @ApiOperation({ summary: 'Toggle allowlist enforcement' })
  async toggleEnforcement(
    @Param('id') merchantId: string,
    @Body() dto: ToggleEnforcementDto,
  ) {
    return this.ipAllowlistService.toggleEnforcement(merchantId, dto.enabled);
  }
}
