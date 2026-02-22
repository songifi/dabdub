import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SandboxController } from './sandbox.controller';
import { SandboxService } from './sandbox.service';
import { SandboxMerchantConfig } from '../database/entities/sandbox-merchant-config.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { PaymentRequest } from '../database/entities/payment-request.entity';
import { WebhookConfigurationEntity } from '../database/entities/webhook-configuration.entity';
import { AuditModule } from '../audit/audit.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SandboxMerchantConfig,
      Transaction,
      PaymentRequest,
      WebhookConfigurationEntity,
    ]),
    AuditModule,
    HttpModule,
  ],
  controllers: [SandboxController],
  providers: [SandboxService],
  exports: [SandboxService],
})
export class SandboxModule {}
