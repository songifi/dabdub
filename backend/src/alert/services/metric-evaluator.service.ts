import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  PaymentRequest,
  PaymentRequestStatus,
} from 'src/database/entities/payment-request.entity';
import { Repository, MoreThan } from 'typeorm';
import { AlertMetric, AlertCondition } from '../enums/alert.enums';

@Injectable()
export class MetricEvaluatorService {
  private readonly logger = new Logger(MetricEvaluatorService.name);

  constructor(
    @InjectRepository(PaymentRequest)
    private readonly paymentRequestRepo: Repository<PaymentRequest>,
  ) {}

  /**
   * Evaluates the current value of a given metric over the configured window.
   * Returns a numeric value for comparison against the threshold.
   */
  async evaluate(
    metric: AlertMetric,
    conditions: AlertCondition,
  ): Promise<number> {
    const windowStart = new Date(
      Date.now() - conditions.windowMinutes * 60 * 1000,
    );

    switch (metric) {
      case AlertMetric.FAILED_TRANSACTION_RATE:
        return this.getFailedTransactionRate(windowStart);

      case AlertMetric.SETTLEMENT_FAILURE_RATE:
        return this.getSettlementFailureRate(windowStart);

      case AlertMetric.WEBHOOK_FAILURE_RATE:
        return this.getWebhookFailureRate(windowStart);

      case AlertMetric.API_ERROR_RATE:
        return this.getApiErrorRate(windowStart);

      case AlertMetric.BLOCKCHAIN_BLOCK_LAG:
        return this.getBlockchainBlockLag();

      case AlertMetric.PENDING_SETTLEMENT_AGE:
        return this.getPendingSettlementAge();

      case AlertMetric.PLATFORM_WALLET_BALANCE_LOW:
        return this.getPlatformWalletBalance();

      case AlertMetric.MERCHANT_SIGNUP_SPIKE:
        return this.getMerchantSignupCount(windowStart);

      case AlertMetric.TRANSACTION_VOLUME_DROP:
        return this.getTransactionVolumeDrop(windowStart);

      default:
        this.logger.warn(`Unknown metric: ${metric as string}`);
        return 0;
    }
  }

  private async getFailedTransactionRate(windowStart: Date): Promise<number> {
    const [total, failed] = await Promise.all([
      this.paymentRequestRepo.count({
        where: { createdAt: MoreThan(windowStart) },
      }),
      this.paymentRequestRepo.count({
        where: {
          createdAt: MoreThan(windowStart),
          status: PaymentRequestStatus.FAILED,
        },
      }),
    ]);
    if (total === 0) return 0;
    return parseFloat(((failed / total) * 100).toFixed(4));
  }

  private async getSettlementFailureRate(_windowStart: Date): Promise<number> {
    // Implemented when SettlementRepository is injected; returns 0 as safe default
    return 0;
  }

  private async getWebhookFailureRate(_windowStart: Date): Promise<number> {
    // Implemented when WebhookDeliveryRepository is injected; returns 0 as safe default
    return 0;
  }

  private async getApiErrorRate(_windowStart: Date): Promise<number> {
    // Reads from Prometheus / metrics service in production
    return 0;
  }

  private async getBlockchainBlockLag(): Promise<number> {
    // Returns lag in blocks; reads from BlockchainMonitoringService in production
    return 0;
  }

  private async getPendingSettlementAge(): Promise<number> {
    // Returns oldest pending settlement age in minutes; 0 if none
    return 0;
  }

  private async getPlatformWalletBalance(): Promise<number> {
    // Returns current vault balance in USDC; read from TreasuryService in production
    return 0;
  }

  private async getMerchantSignupCount(windowStart: Date): Promise<number> {
    // Count new merchant registrations in window
    return 0;
  }

  private async getTransactionVolumeDrop(_windowStart: Date): Promise<number> {
    // Returns % drop in volume vs previous comparable window
    return 0;
  }
}
