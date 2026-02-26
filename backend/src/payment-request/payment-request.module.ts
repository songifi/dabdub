import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { PaymentRequest } from '../database/entities/payment-request.entity';
import { Merchant } from '../database/entities/merchant.entity';
import { WebhookConfigurationEntity } from '../database/entities/webhook-configuration.entity';
import { PaymentRequestRepository } from './repositories/payment-request.repository';
import { PaymentRequestService } from './payment-request.service';
import { PaymentRequestController } from './payment-request.controller';
import { QrCodeService } from './services/qr-code.service';
import { ExpirationSchedulerService } from './services/expiration-scheduler.service';
import { StellarContractService } from './services/stellar-contract.service';
import { GlobalConfigModule } from '../config/config.module';
import {
  PaymentExpiryProcessor,
  PAYMENT_EXPIRY_QUEUE,
} from './processors/payment-expiry.processor';
import { WebhookDeliveryService } from '../webhook/services/webhook-delivery.service';
import { WebhookDeliveryLogEntity } from '../database/entities/webhook-delivery-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentRequest,
      Merchant,
      WebhookConfigurationEntity,
      WebhookDeliveryLogEntity,
    ]),
    BullModule.registerQueue({
      name: PAYMENT_EXPIRY_QUEUE,
    }),
    GlobalConfigModule,
  ],
  controllers: [PaymentRequestController],
  providers: [
    PaymentRequestRepository,
    PaymentRequestService,
    QrCodeService,
    ExpirationSchedulerService,
    StellarContractService,
    PaymentExpiryProcessor,
    WebhookDeliveryService,
  ],
  exports: [PaymentRequestService, PaymentRequestRepository],
})
export class PaymentRequestModule {}
