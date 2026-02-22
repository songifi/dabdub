import { Controller, Get, Patch, Post, Param, Body, UseGuards } from '@nestjs/common';
import { PrivacyService } from '../services/privacy.service';
import { MerchantDataDeletionService } from '../services/merchant-data-deletion.service';
import { DataExportService } from '../services/data-export.service';
import { UpdateDeletionRequestDto } from '../dto/update-deletion-request.dto';
import { AuditLogService } from '../../audit/audit-log.service';
import { SuperAdminGuard } from '../../auth/guards/super-admin.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@Controller('api/v1/privacy')
@UseGuards(SuperAdminGuard)
export class PrivacyController {
  constructor(
    private readonly privacyService: PrivacyService,
    private readonly deletionService: MerchantDataDeletionService,
    private readonly exportService: DataExportService,
    private readonly auditService: AuditLogService,
  ) {}

  @Get('deletion-requests')
  async getDeletionRequests() {
    return this.privacyService.getAllDeletionRequests();
  }

  @Get('deletion-requests/:id')
  async getDeletionRequest(@Param('id') id: string) {
    return this.privacyService.getDeletionRequest(id);
  }

  @Patch('deletion-requests/:id')
  async updateDeletionRequest(
    @Param('id') id: string,
    @Body() dto: UpdateDeletionRequestDto,
    @CurrentUser() user: any,
  ) {
    const request = await this.privacyService.updateDeletionRequest(id, dto);

    await this.auditService.log({
      entityType: 'DataDeletionRequest',
      entityId: id,
      action: 'UPDATE',
      actorId: user.id,
      actorType: 'ADMIN',
      afterState: request,
    });

    return request;
  }

  @Post('deletion-requests/:id/execute')
  async executeDeletion(@Param('id') id: string, @CurrentUser() user: any) {
    await this.privacyService.validateExecutionEligibility(id);

    const request = await this.privacyService.getDeletionRequest(id);
    await this.privacyService.markAsProcessing(id);

    const deletedDataSummary = await this.deletionService.deleteMerchantData(
      request.merchantId,
    );

    await this.privacyService.markAsCompleted(id, deletedDataSummary);

    await this.auditService.log({
      entityType: 'Merchant',
      entityId: request.merchantId,
      action: 'MERCHANT_DATA_DELETED',
      actorId: user.id,
      actorType: 'ADMIN',
      metadata: { deletionRequestId: id, deletedDataSummary },
      dataClassification: 'PERMANENT',
    });

    return { success: true, deletedDataSummary };
  }

  @Post('exports/:merchantId')
  async generateExport(@Param('merchantId') merchantId: string, @CurrentUser() user: any) {
    const downloadLink = await this.exportService.generateMerchantDataExport(merchantId);

    await this.auditService.log({
      entityType: 'Merchant',
      entityId: merchantId,
      action: 'DATA_EXPORT_REQUESTED',
      actorId: user.id,
      actorType: 'ADMIN',
    });

    return { downloadLink };
  }
}
