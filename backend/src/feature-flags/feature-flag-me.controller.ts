import { Controller, Get, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { User } from '../users/entities/user.entity';
import { FeatureFlagService } from './feature-flag.service';

type AuthReq = Request & { user: User };

@ApiTags('me')
@ApiBearerAuth()
@Controller({ path: 'me', version: '1' })
export class FeatureFlagMeController {
  constructor(private readonly featureFlags: FeatureFlagService) {}

  @Get('feature-flags')
  @ApiOperation({
    summary: 'Enabled feature flag keys for the current user (e.g. after login)',
  })
  async getMyFlags(@Req() req: AuthReq): Promise<{ enabledKeys: string[] }> {
    const enabledKeys = await this.featureFlags.getEnabledFlags(
      req.user.id,
      req.user.tier,
    );
    return { enabledKeys };
  }
}
