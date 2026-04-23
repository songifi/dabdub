import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAlertModule } from '../alerts/admin-alert.module';
import { SettlementsService } from './settlements.service';
import { SettlementsController, PartnerCallbackController } from './settlements.controller';
import { Settlement } from './entities/settlement.entity';
import { Payment } from '../payments/entities/payment.entity';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { PartnerSignatureGuard } from './guards/partner-signature.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Settlement, Payment]),
    AdminAlertModule,
    WebhooksModule,
  ],
  controllers: [SettlementsController, PartnerCallbackController],
  providers: [SettlementsService, PartnerSignatureGuard],
  exports: [SettlementsService],
})
export class SettlementsModule {}
