import { Controller, Get, Post, Patch, Param, Body, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminRole } from '../admin/entities/admin.entity';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { FeatureFlagsService } from './feature-flags.service';
import { CreateFeatureFlagDto } from './dto/create-feature-flag.dto';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import { FeatureFlag } from './entities/feature-flag.entity';

interface RequestWithUser extends Request {
  user?: { id: string; tier?: string };
}

@ApiTags('feature-flags')
@ApiBearerAuth()
@Controller({ path: 'me/feature-flags', version: '1' })
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Get()
  @ApiOperation({ summary: 'Get enabled feature flags for current user' })
  async getEnabledFlags(@Req() req: RequestWithUser): Promise<string[]> {
    return this.featureFlagsService.getEnabledFlags(req.user!.id, req.user?.tier);
  }
}

@ApiTags('admin.feature-flags')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller({ path: 'admin/feature-flags', version: '1' })
export class AdminFeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Get()
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'List all feature flags' })
  async listAll(): Promise<FeatureFlag[]> {
    return this.featureFlagsService.listAll();
  }

  @Post()
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'Create a feature flag' })
  async create(
    @Req() req: RequestWithUser,
    @Body() dto: CreateFeatureFlagDto,
  ): Promise<FeatureFlag> {
    return this.featureFlagsService.create(req.user!.id, dto);
  }

  @Patch(':key')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'Update a feature flag' })
  async update(
    @Param('key') key: string,
    @Body() dto: UpdateFeatureFlagDto,
  ): Promise<FeatureFlag> {
    return this.featureFlagsService.update(key, dto);
  }
}
