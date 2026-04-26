import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import { Settlement, SettlementStatus } from "./entities/settlement.entity";
import { Payment, PaymentStatus } from "../payments/entities/payment.entity";
import { WebhooksService } from "../webhooks/webhooks.service";

@Injectable()
export class SettlementsService {
  private readonly logger = new Logger(SettlementsService.name);

  constructor(
    @InjectRepository(Settlement)
    private settlementsRepo: Repository<Settlement>,
    @InjectRepository(Payment)
    private paymentsRepo: Repository<Payment>,
    private config: ConfigService,
    private webhooks: WebhooksService,
  ) {}

  async initiateSettlement(payment: Payment): Promise<void> {
    const feeRate = 0.015;
    const feeUsd = payment.amountUsd * feeRate;
    const netUsd = payment.amountUsd - feeUsd;

    const settlement = this.settlementsRepo.create({
      merchantId: payment.merchantId,
      totalAmountUsd: payment.amountUsd,
      feeAmountUsd: feeUsd,
      netAmountUsd: netUsd,
      fiatCurrency: "NGN",
      status: SettlementStatus.PROCESSING,
    });

    const saved = await this.settlementsRepo.save(settlement);

    payment.status = PaymentStatus.SETTLING;
    payment.feeUsd = feeUsd;
    payment.settlementId = saved.id;
    await this.paymentsRepo.save(payment);

    await this.webhooks.dispatch(payment.merchantId, "payment.settling", {
      paymentId: payment.id,
      settlementId: saved.id,
    });

    await this.executeFiatTransfer(saved, payment);
  }

  private async executeFiatTransfer(
    settlement: Settlement,
    payment: Payment,
  ): Promise<void> {
    const partnerUrl = this.config.get("PARTNER_API_URL");
    const partnerKey = this.config.get("PARTNER_API_KEY");

    try {
      const response = await axios.post(
        `${partnerUrl}/transfers`,
        {
          amount: settlement.netAmountUsd,
          currency: "USD",
          merchantId: settlement.merchantId,
          reference: settlement.id,
        },
        { headers: { Authorization: `Bearer ${partnerKey}` } },
      );

      settlement.status = SettlementStatus.COMPLETED;
      settlement.partnerReference = response.data?.reference;
      settlement.completedAt = new Date();
      await this.settlementsRepo.save(settlement);

      payment.status = PaymentStatus.SETTLED;
      await this.paymentsRepo.save(payment);

      await this.webhooks.dispatch(settlement.merchantId, "payment.settled", {
        paymentId: payment.id,
        settlementId: settlement.id,
        amount: settlement.netAmountUsd,
      });
    } catch (err) {
      this.logger.error(`Settlement failed for ${settlement.id}`, err.message);

      settlement.status = SettlementStatus.FAILED;
      settlement.failureReason = err.message;
      await this.settlementsRepo.save(settlement);

      payment.status = PaymentStatus.FAILED;
      await this.paymentsRepo.save(payment);

      await this.webhooks.dispatch(settlement.merchantId, "payment.failed", {
        paymentId: payment.id,
        reason: err.message,
      });
    }
  }

  async findAll(merchantId: string, page = 1, limit = 20) {
    const [settlements, total] = await this.settlementsRepo.findAndCount({
      where: { merchantId },
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { settlements, total, page, limit };
  }
}
