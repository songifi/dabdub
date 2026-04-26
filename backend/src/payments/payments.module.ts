import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PaymentsService } from "./payments.service";
import {
  PaymentsController,
  PublicPaymentController,
} from "./payments.controller";
import { Payment } from "./entities/payment.entity";
import { StellarModule } from "../stellar/stellar.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    forwardRef(() => StellarModule),
    NotificationsModule,
  ],
  controllers: [PaymentsController, PublicPaymentController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
