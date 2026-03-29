import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Admin } from '../admin/entities/admin.entity';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { FeatureFlagService } from './feature-flag.service';
import { CreateFeatureFlagDto } from './dto/create-feature-flag.dto';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';

type AdminReq = Request & { user: Admin };

@ApiTags('admin/feature-flags')
@ApiBearerAuth()
@UseGuards(SuperAdminGuard)
@Controller({ path: 'admin/feature-flags', version: '1' })
export class FeatureFlagAdminController {
  constructor(private readonly featureFlags: FeatureFlagService) {}

  @Get()
  @ApiOperation({ summary: 'List all feature flags' })
  list() {
    return this.featureFlags.listAll();
  }

  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Create a feature flag' })
  create(@Req() req: AdminReq, @Body() dto: CreateFeatureFlagDto) {
    return this.featureFlags.create(req.user.id, dto);
  }

  @Patch(':key')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Update a feature flag (invalidates Redis cache)' })
  update(@Param('key') key: string, @Body() dto: UpdateFeatureFlagDto) {
    return this.featureFlags.updateByKey(key, dto);
  }
}
