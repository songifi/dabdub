import { Controller, Get, Patch, Post, Param, Body, UseGuards } from '@nestjs/common';
import { DataRetentionService } from '../services/data-retention.service';
import { DataPurgeService } from '../services/data-purge.service';
import { UpdateRetentionPolicyDto } from '../dto/update-retention-policy.dto';
import { AuditLogService } from '../../audit/audit-log.service';
import { SuperAdminGuard } from '../../auth/guards/super-admin.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@Controller('api/v1/data-retention')
@UseGuards(SuperAdminGuard)
export class DataRetentionController {
  constructor(
    private readonly retentionService: DataRetentionService,
    private readonly purgeService: DataPurgeService,
    private readonly auditService: AuditLogService,
  ) {}

  @Get('policies')
  async getPolicies() {
    return this.retentionService.getAllPolicies();
  }

  @Patch('policies/:dataType')
  async updatePolicy(
    @Param('dataType') dataType: string,
    @Body() dto: UpdateRetentionPolicyDto,
    @CurrentUser() user: any,
  ) {
    const policy = await this.retentionService.updatePolicy(dataType, dto);

    await this.auditService.log({
      entityType: 'DataRetentionPolicy',
      entityId: policy.id,
      action: 'UPDATE',
      actorId: user.id,
      actorType: 'ADMIN',
      afterState: policy,
    });

    return policy;
  }

  @Post('policies/:dataType/run-purge')
  async runPurge(@Param('dataType') dataType: string, @CurrentUser() user: any) {
    const estimatedRows = await this.purgeService.estimateRowsToDelete(dataType);

    await this.auditService.log({
      entityType: 'DataRetentionPolicy',
      entityId: dataType,
      action: 'DATA_PURGE_TRIGGERED',
      actorId: user.id,
      actorType: 'ADMIN',
      metadata: { estimatedRows },
    });

    // Enqueue job
    const jobId = `purge-${dataType}-${Date.now()}`;

    return {
      jobId,
      estimatedRowsToDelete: estimatedRows,
    };
  }

  @Get('purge-history')
  async getPurgeHistory() {
    return this.retentionService.getPurgeHistory();
  }
}
