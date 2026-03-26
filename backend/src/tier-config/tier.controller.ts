import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  UseGuards,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { TierService } from './tier.service';
import { TierName } from './entities/tier-config.entity';
import { Public } from '../auth/decorators/public.decorator';

@Controller()
export class TierController {
  constructor(private readonly tierService: TierService) {}

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

  @Patch('admin/users/:id/tier')
  async updateUserTier(
    @Param('id') userId: string,
    @Body('tier') tier: TierName,
  ) {
    return this.tierService.upgradeTier(userId, tier);
  }
}
