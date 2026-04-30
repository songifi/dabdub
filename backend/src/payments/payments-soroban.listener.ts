import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PaymentConfirmedEventDto } from '../stellar/soroban-event.dto';
import { PaymentsService } from './payments.service';

@Injectable()
export class PaymentsSorobanListener {
  constructor(private readonly paymentsService: PaymentsService) {}

  @OnEvent('soroban.payment.confirmed', { async: true })
  async handlePaymentConfirmed(event: PaymentConfirmedEventDto): Promise<void> {
    await this.paymentsService.applySorobanPaymentConfirmed(event);
  }
}
