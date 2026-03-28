import { Controller, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppConfigService } from './app-config.service';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { User } from '../users/entities/user.entity';

@ApiTags('admin/config')
@ApiBearerAuth()
@UseGuards(SuperAdminGuard)
@Controller({ path: 'admin/config', version: '1' })
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get()
  @ApiOperation({ summary: 'List all runtime config entries' })
  getAll() {
    return this.appConfigService.getAll();
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Update a runtime config value' })
  update(
    @Param('key') key: string,
    @Body('value') value: unknown,
    @Request() req: { user: User },
  ) {
    return this.appConfigService.set(key, value, req.user.id);
  }
}
