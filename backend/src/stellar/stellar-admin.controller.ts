import { Controller, Get, Param, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminRole } from '../admin/entities/admin.entity';
import { StellarAssetService } from './stellar-asset.service';

@ApiTags('admin-blockchain')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller({ path: 'admin/blockchain', version: '1' })
export class StellarAdminController {
  constructor(private readonly stellarAssetService: StellarAssetService) {}

  @Get('account/:address')
  @SetMetadata('roles', [AdminRole.ADMIN, AdminRole.SUPERADMIN])
  @ApiOperation({ summary: 'Admin: full Stellar account details including trust lines and balances' })
  getAccountDetails(@Param('address') address: string) {
    return this.stellarAssetService.getAccountDetails(address);
  }
}
