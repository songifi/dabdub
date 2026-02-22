import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { MerchantDataDeletionService } from '../services/merchant-data-deletion.service';

@Processor('merchant-data-deletion')
export class MerchantDataDeletionProcessor {
  private readonly logger = new Logger(MerchantDataDeletionProcessor.name);

  constructor(
    private readonly deletionService: MerchantDataDeletionService,
  ) {}

  @Process('delete-merchant-data')
  async handleDeletion(job: Job<{ merchantId: string; deletionRequestId: string }>) {
    const { merchantId, deletionRequestId } = job.data;

    this.logger.log(`Starting merchant data deletion for ${merchantId}`);

    try {
      const deletedDataSummary = await this.deletionService.deleteMerchantData(merchantId);

      this.logger.log(`Merchant data deletion completed for ${merchantId}`);

      return { success: true, deletedDataSummary };
    } catch (error) {
      this.logger.error(`Merchant data deletion failed for ${merchantId}:`, error);
      throw error;
    }
  }
}
