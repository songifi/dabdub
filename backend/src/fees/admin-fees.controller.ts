import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminRole } from '../admin/entities/admin.entity';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateFeeConfigDto } from './dto/create-fee-config.dto';
import { QueryFeeRecordsDto } from './dto/query-fee-records.dto';
import { FeesService } from './fees.service';

@ApiTags('admin-fees')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller({ path: 'admin/fees', version: '1' })
export class AdminFeesController {
  constructor(private readonly feesService: FeesService) {}

  @Get('configs')
  @SetMetadata('roles', [AdminRole.ADMIN, AdminRole.SUPERADMIN])
  @ApiOperation({ summary: 'List fee configs' })
  getConfigs() {
    return this.feesService.listConfigs();
  }

  @Post('configs')
  @SetMetadata('roles', [AdminRole.ADMIN, AdminRole.SUPERADMIN])
  @ApiOperation({ summary: 'Create fee config' })
  createConfig(
    @Body() dto: CreateFeeConfigDto,
    @Req() req: Request & { user: { id: string } },
  ) {
    return this.feesService.createConfig({
      type: dto.type,
      rateType: dto.rateType,
      value: dto.value,
      effectiveFrom: new Date(dto.effectiveFrom),
      isActive: dto.isActive ?? true,
      createdBy: req.user.id,
    });
  }

  @Patch('configs/:id/deactivate')
  @SetMetadata('roles', [AdminRole.ADMIN, AdminRole.SUPERADMIN])
  @ApiOperation({ summary: 'Deactivate fee config' })
  deactivateConfig(@Param('id') id: string) {
    return this.feesService.deactivateConfig(id);
  }

  @Get('records')
  @SetMetadata('roles', [AdminRole.ADMIN, AdminRole.SUPERADMIN])
  @ApiOperation({ summary: 'List fee records with filters and pagination' })
  getRecords(@Query() query: QueryFeeRecordsDto) {
    return this.feesService.listRecords(query);
  }

  @Get('summary')
  @SetMetadata('roles', [AdminRole.ADMIN, AdminRole.SUPERADMIN])
  @ApiOperation({ summary: 'Get total fees by type for today and this month' })
  getSummary() {
    return this.feesService.getSummary();
  }
}
