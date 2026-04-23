import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CronJobService } from '../../cron/cron-job.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminRole } from '../entities/admin.entity';
import { CronJobLog } from '../../cron/entities/cron-job-log.entity';

@ApiTags('admin.crons')
@UseGuards(RolesGuard)
@Controller({ path: 'admin/crons', version: '1' })
export class CronAdminController {
  constructor(private cronService: CronJobService) {}

  @Get()
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'List cron jobs status' })
  async listJobs() {
    // Return registry + last run stats
    return []; // TODO: implement
  }

  @Get(':jobName/history')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'Job history' })
  async getHistory(
    @Param('jobName') jobName: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return []; // TODO: paginated logs
  }

  @Post(':jobName/trigger')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'Manual trigger' })
  async triggerJob(@Param('jobName') jobName: string) {
    // Validate jobName in registry, then run
    return { triggered: true };
  }
}

