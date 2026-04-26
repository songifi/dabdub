import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RuntimeConfigService } from './runtime-config.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Request } from 'express';

@ApiTags('admin / config')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.SUPERADMIN)
@Controller('admin/config')
export class RuntimeConfigController {
  constructor(private readonly runtimeConfigService: RuntimeConfigService) {}

  @Get()
  @ApiOperation({ summary: 'List all runtime configurations' })
  async getAll() {
    return this.runtimeConfigService.getAll();
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Update a runtime configuration' })
  async update(
    @Param('key') key: string,
    @Body() body: { value: any; description?: string },
    @Req() req: Request,
  ) {
    const adminId = (req as any).user.id;
    return this.runtimeConfigService.set(key, body.value, adminId, body.description);
  }
}
