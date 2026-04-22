import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { StellarService } from './stellar.service';
import { SettlementsService } from '../settlements/settlements.service';
import { WebhooksService } from '../webhooks/webhooks.service';

@Injectable()
export class StellarMonitorService {
  private readonly logger = new Logger(StellarMonitorService.name);
  private cursors: Map<string, string> = new Map();

  constructor(
    @InjectRepository(Payment)
    private paymentsRepo: Repository<Payment>,
    private stellar: StellarService,
    private settlements: SettlementsService,
    private webhooks: WebhooksService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async scanPendingPayments() {
    const pendingPayments = await this.paymentsRepo.find({
      where: { status: PaymentStatus.PENDING },
      relations: ['merchant'],
    });

    if (!pendingPayments.length) return;

    const depositAddress = this.stellar.getDepositAddress();
    if (!depositAddress) return;

    const cursor = this.cursors.get(depositAddress);
    let transactions: any[];

    try {
      transactions = await this.stellar.getAccountTransactions(depositAddress, cursor);
    } catch (err) {
      this.logger.error('Failed to fetch Stellar transactions', err.message);
      return;
    }

    for (const tx of transactions) {
      this.cursors.set(depositAddress, tx.paging_token);

      const paymentMemo = tx.memo;
      if (!paymentMemo) continue;

      const matched = pendingPayments.find((p) => p.stellarMemo === paymentMemo);
      if (!matched) continue;

      const result = await this.stellar.verifyPayment(tx.hash, paymentMemo);
      if (!result.verified) continue;

      await this.confirmPayment(matched, tx.hash, result.amount, result.asset);
    }

    await this.expireOldPayments();
  }

  private async confirmPayment(
    payment: Payment,
    txHash: string,
    amount: number,
    asset: string,
  ) {
    this.logger.log(`Payment confirmed: ${payment.reference} | tx: ${txHash}`);

    payment.status = PaymentStatus.CONFIRMED;
    payment.txHash = txHash;
    payment.confirmedAt = new Date();

    if (asset === 'USDC') payment.amountUsdc = amount;
    else payment.amountXlm = amount;

    await this.paymentsRepo.save(payment);

    await this.webhooks.dispatch(payment.merchantId, 'payment.confirmed', {
      paymentId: payment.id,
      reference: payment.reference,
      txHash,
      amount,
      asset,
    });

    await this.settlements.initiateSettlement(payment);
  }

  private async expireOldPayments() {
    const now = new Date();
    const expired = await this.paymentsRepo
      .createQueryBuilder('payment')
      .where('payment.status = :status', { status: PaymentStatus.PENDING })
      .andWhere('payment.expiresAt < :now', { now })
      .getMany();

    for (const payment of expired) {
      payment.status = PaymentStatus.EXPIRED;
      await this.paymentsRepo.save(payment);

      await this.webhooks.dispatch(payment.merchantId, 'payment.expired', {
        paymentId: payment.id,
        reference: payment.reference,
      });
    }
  }
}
