import { BullModule } from '@nestjs/bull';
import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { EmailModule } from '../email/email.module';
import { FraudFlag } from '../fraud/entities/fraud-flag.entity';
import { KycSubmission } from '../kyc/entities/kyc-submission.entity';
import { RbacModule } from '../rbac/rbac.module';
import { TierConfig } from '../tier-config/entities/tier-config.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import { ComplianceController } from './compliance.controller';
import { ComplianceProcessor } from './compliance.processor';
import {
  COMPLIANCE_QUEUE,
  ComplianceDashboardService,
} from './compliance.service';
import { ComplianceEvent } from './entities/compliance-event.entity';
import { SuspiciousActivityReport } from './entities/suspicious-activity-report.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ComplianceEvent,
      SuspiciousActivityReport,
      User,
      Transaction,
      FraudFlag,
      KycSubmission,
      TierConfig,
    ]),
    BullModule.registerQueue({ name: COMPLIANCE_QUEUE }),
    RbacModule,
    AuditModule,
    EmailModule,
  ],
  controllers: [ComplianceController],
  providers: [ComplianceDashboardService, ComplianceProcessor],
  exports: [ComplianceDashboardService],
})
export class ComplianceModule implements OnModuleInit {
  constructor(
    private readonly complianceService: ComplianceDashboardService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.complianceService.enqueueDailyStructuringDetection();
  }
}
