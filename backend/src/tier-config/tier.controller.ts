import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { TierService } from './tier.service';
import { TierConfig } from './entities/tier-config.entity';
import { Public } from '../auth/decorators/public.decorator';
import { TierConfigResponseDto } from './dto/tier-config-response.dto';
import { UserTierUpdateResponseDto } from './dto/user-tier-update-response.dto';
import { UpdateUserTierDto } from './dto/update-user-tier.dto';

@ApiTags('tier')
@Controller()
export class TierController {
  constructor(private readonly tierService: TierService) {}

  @Public()
  @Get('tier')
  @ApiOperation({ summary: 'List active tier configurations' })
  @ApiOkResponse({ type: TierConfigResponseDto, isArray: true })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getAllTierConfigs(): Promise<TierConfig[]> {
    return this.tierService.getTierConfigs();
  }

  @Public()
  @Get('tier/limits')
  @ApiOperation({
    summary: 'Tier limits (same payload as GET /tier)',
    description: 'Alias for clients that expect a /limits path.',
  })
  @ApiOkResponse({ type: TierConfigResponseDto, isArray: true })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getAllLimits(): Promise<TierConfig[]> {
    return this.tierService.getTierConfigs();
  }

  @Patch('admin/users/:id/tier')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update a user tier (requires JWT on the caller)' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Target user id' })
  @ApiOkResponse({ type: UserTierUpdateResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async updateUserTier(
    @Param('id') userId: string,
    @Body() dto: UpdateUserTierDto,
    @Req() req: Request,
  ): Promise<UserTierUpdateResponseDto> {
    if (!(req as { user?: { id: string } }).user?.id) {
      throw new UnauthorizedException();
    }
    const user = await this.tierService.upgradeTier(userId, dto.tier);
    return {
      id: user.id,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      email: user.email,
      username: user.username,
      tier: user.tier,
      isActive: user.isActive,
    };
  }
}
