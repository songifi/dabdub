import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TierService } from './tier.service';
import { TierUpgradeService } from './tier-upgrade.service';
import { TierName } from './entities/tier-config.entity';
import { Public } from '../auth/decorators/public.decorator';
import { AuditInterceptor, Audit } from '../audit/audit.interceptor';
import { User } from '../users/entities/user.entity';
import { TierUpgradeRequirementsQueryDto } from './dto/tier-upgrade-requirements-query.dto';
import { InitiateTierUpgradeDto } from './dto/initiate-tier-upgrade.dto';

type AuthReq = Request & { user: User };

@ApiTags('tier')
@Controller({ version: '1' })
export class TierController {
  constructor(
    private readonly tierService: TierService,
    private readonly tierUpgradeService: TierUpgradeService,
  ) {}

  @Public()
  @Get('tier')
  async getAllTierConfigs() {
    return this.tierService.getTierConfigs();
  }

  @Public()
  @Get('tier/limits')
  async getAllLimits() {
    return this.tierService.getTierConfigs();
  }

  @Public()
  @Get('tier/benefits')
  @ApiOperation({
    summary: 'Public tier comparison (limits, fees, APY, stake, virtual card)',
  })
  async getTierBenefitsTable() {
    return this.tierUpgradeService.getPublicTierBenefitsTable();
  }

  @ApiBearerAuth()
  @Get('tier/upgrade/requirements')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'What is still required to reach the target tier' })
  async getUpgradeRequirements(
    @Req() req: AuthReq,
    @Query() query: TierUpgradeRequirementsQueryDto,
  ) {
    return this.tierUpgradeService.getUpgradeRequirements(
      req.user.id,
      query.target,
    );
  }

  @ApiBearerAuth()
  @Get('tier/upgrade/status')
  @ApiOperation({ summary: 'Pending upgrade target and blocking reasons' })
  async getUpgradeStatus(@Req() req: AuthReq) {
    return this.tierUpgradeService.getUpgradeStatus(req.user.id);
  }

  @ApiBearerAuth()
  @Post('tier/upgrade')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Start or complete tier upgrade from the app' })
  async initiateTierUpgrade(
    @Req() req: AuthReq,
    @Body() body: InitiateTierUpgradeDto,
  ) {
    return this.tierUpgradeService.initiateUpgrade(req.user.id, body.targetTier);
  }

  @Patch('admin/users/:id/tier')
  @UseInterceptors(AuditInterceptor)
  @Audit({ action: 'user.tier_change', resourceType: 'user', resourceIdParam: 'id' })
  async updateUserTier(
    @Param('id') userId: string,
    @Body('tier') tier: TierName,
  ) {
    return this.tierService.upgradeTier(userId, tier);
  }
}
