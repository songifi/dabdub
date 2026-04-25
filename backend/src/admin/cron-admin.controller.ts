import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MerchantRole } from '../merchants/entities/merchant.entity';
import { CronJobService } from '../cron/cron-job.service';

@ApiTags('admin.crons')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(MerchantRole.ADMIN, MerchantRole.SUPERADMIN)
@Controller({ path: 'admin/crons', version: '1' })
export class CronAdminController {
  constructor(private cronService: CronJobService) {}

  @Get()
  @ApiOperation({ summary: 'List cron jobs status' })
  async listJobs() {
    return [];
  }

  @Get(':jobName/history')
  @ApiOperation({ summary: 'Job history' })
  async getHistory(
    @Param('jobName') jobName: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return [];
  }

  @Post(':jobName/trigger')
  @ApiOperation({ summary: 'Manual trigger' })
  async triggerJob(@Param('jobName') jobName: string) {
    return { triggered: true };
  }
}

