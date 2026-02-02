import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

// Entities
import { KycVerification } from './entities/kyc-verification.entity';
import { KycDocument } from './entities/kyc-document.entity';
import { KycAuditLog } from './entities/kyc-audit-log.entity';

// Controllers
import { KycVerificationController } from './controllers/kyc-verification.controller';
import { KycAdminController } from './controllers/kyc-admin.controller';

// Services
import { KycVerificationService } from './services/kyc-verification.service';
import { KycDocumentService } from './services/kyc-document.service';
import { KycAuditService } from './services/kyc-audit.service';
import { StorageService } from './services/storage.service';
import { VerificationProviderService } from './services/verification-provider.service';
import { RiskAssessmentService } from './services/risk-assessment.service';

// Processors
import { KycProcessingProcessor } from './processors/kyc-processing.processor';
import { DocumentProcessingProcessor } from './processors/document-processing.processor';

// External modules
import { NotificationModule } from '../notification/notification.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KycVerification,
      KycDocument,
      KycAuditLog,
    ]),
    BullModule.registerQueue(
      {
        name: 'kyc-processing',
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      },
      {
        name: 'document-processing',
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      },
    ),
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    ConfigModule,
    NotificationModule,
    AuthModule,
  ],
  controllers: [
    KycVerificationController,
    KycAdminController,
  ],
  providers: [
    KycVerificationService,
    KycDocumentService,
    KycAuditService,
    StorageService,
    VerificationProviderService,
    RiskAssessmentService,
    KycProcessingProcessor,
    DocumentProcessingProcessor,
  ],
  exports: [
    KycVerificationService,
    KycDocumentService,
    KycAuditService,
    StorageService,
  ],
})
export class KycModule {}