import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { DataRetentionPolicy } from './entities/data-retention-policy.entity';
import { DataDeletionRequest } from './entities/data-deletion-request.entity';
import { DataRetentionService } from './services/data-retention.service';
import { PrivacyService } from './services/privacy.service';
import { DataPurgeService } from './services/data-purge.service';
import { MerchantDataDeletionService } from './services/merchant-data-deletion.service';
import { DataExportService } from './services/data-export.service';
import { DataRetentionController } from './controllers/data-retention.controller';
import { PrivacyController } from './controllers/privacy.controller';
import { DataPurgeProcessor } from './processors/data-purge.processor';
import { MerchantDataDeletionProcessor } from './processors/merchant-data-deletion.processor';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DataRetentionPolicy, DataDeletionRequest]),
    BullModule.registerQueue(
      { name: 'data-purge' },
      { name: 'merchant-data-deletion' },
    ),
    AuditModule,
  ],
  controllers: [DataRetentionController, PrivacyController],
  providers: [
    DataRetentionService,
    PrivacyService,
    DataPurgeService,
    MerchantDataDeletionService,
    DataExportService,
    DataPurgeProcessor,
    MerchantDataDeletionProcessor,
  ],
  exports: [DataRetentionService, PrivacyService],
})
export class PrivacyModule {}
