import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as Sentry from '@sentry/nestjs';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { AdminAlertService } from '../alerts/admin-alert.service';
import { AdminAlertType } from '../alerts/admin-alert.entity';
import { StellarService } from './stellar.service';

interface SorobanEvent {
  type: string;
  ledger: number;
  ledgerClosedAt: string;
  contractId: string;
  id: string;
  pagingToken: string;
  topic: string[];
  value: any;
}

interface SorobanEventsResponse {
  events: SorobanEvent[];
  latestLedger: number;
}

type EscrowEventTopic = 'deposit' | 'release' | 'refund' | 'expired' | 'dispute';

interface EscrowEventPayload {
  payment_id?: string;
  paymentId?: string;
  amount?: string | number;
}

/**
 * SorobanMonitorService: polls escrow contract state-transition events through
 * Soroban RPC getEvents and maps them into backend PaymentStatus updates.
 */
@Injectable()
export class SorobanMonitorService {
  private readonly logger = new Logger(SorobanMonitorService.name);
  private readonly processedEventIds = new Set<string>();
  private startLedger = 0;
  private rpcUrl: string;
  private escrowContractId: string;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepo: Repository<Payment>,
    private readonly config: ConfigService,
    private readonly adminAlerts: AdminAlertService,
    private readonly stellar: StellarService,
  ) {
    this.rpcUrl = this.config.get<string>(
      'SOROBAN_RPC_URL',
      'https://soroban-testnet.stellar.org',
    );
    this.escrowContractId = this.config.get<string>(
      'SOROBAN_ESCROW_CONTRACT_ID',
      '',
    );
  }

  /**
   * Poll Soroban RPC for escrow events and map them to payment statuses.
   * Called by the Stellar monitor Bull job every 30 seconds.
   */
  async pollEscrowEvents(): Promise<void> {
    if (!this.escrowContractId) {
      this.logger.debug('SOROBAN_ESCROW_CONTRACT_ID not set — skipping Soroban event poll');
      return;
    }

    let events: SorobanEvent[];
    let latestLedger: number;

    try {
      ({ events, latestLedger } = await this.getEvents());
    } catch (err) {
      this.logger.warn(`Soroban getEvents failed: ${(err as Error).message}`);
      await this.adminAlerts.raise({
        type: AdminAlertType.STELLAR_MONITOR,
        dedupeKey: 'soroban-monitor.fetch',
        message: `Soroban RPC getEvents failed: ${(err as Error).message}`,
        metadata: { rpcUrl: this.rpcUrl },
        thresholdValue: 1,
      });
      return;
    }

    if (!events.length) return;

    // Update cursor to latest ledger for next poll
    this.startLedger = latestLedger;

    const payments = await this.paymentsRepo.find();

    if (!payments.length) return;

    for (const event of events) {
      // De-duplicate: skip already processed events
      if (this.processedEventIds.has(event.id)) continue;
      this.processedEventIds.add(event.id);

      // Keep de-dup set bounded to last 10 000 event IDs
      if (this.processedEventIds.size > 10_000) {
        const oldest = this.processedEventIds.values().next().value;
        this.processedEventIds.delete(oldest);
      }

      await this.processEscrowEvent(event, payments);
    }
  }

  private async processEscrowEvent(event: SorobanEvent, payments: Payment[]): Promise<void> {
    const topic = this.extractTopic(event.topic);
    if (!topic) return;

    const payload = this.normalizePayload(event.value);
    const paymentId = payload.payment_id ?? payload.paymentId;
    if (!paymentId) return;

    const matched = payments.find((payment) => this.matchesEscrowPaymentId(payment, paymentId));
    if (!matched) return;

    // ── Balance verification on deposit ──────────────────────────────────────
    // Before confirming a deposit event, query the escrow contract to verify
    // the on-chain balance matches the expected payment amount. Short-paid
    // deposits are flagged and skipped — they must not be auto-settled.
    if (topic === 'deposit') {
      const shortPaid = await this.verifyDepositBalance(matched, paymentId, event.id);
      if (shortPaid) return;
    }

    const nextStatus = this.mapTopicToStatus(topic);
    if (!nextStatus || matched.status === nextStatus) return;

    matched.status = nextStatus;
    await this.paymentsRepo.save(matched);

    const amount = this.extractAmount(payload);
    this.logger.log(
      `Soroban escrow event ${topic} mapped payment ${matched.reference} -> ${nextStatus} (event ${event.id}${amount !== null ? `, amount=${amount}` : ''})`,
    );
  }

  /**
   * Query the escrow contract's get_balance view function and compare the
   * on-chain balance against the payment's expected USDC amount.
   *
   * Returns true (short-paid / mismatch) when the balance check fails and the
   * deposit should NOT be confirmed. Returns false when the balance is
   * sufficient and processing can continue.
   */
  private async verifyDepositBalance(
    payment: Payment,
    escrowPaymentId: string,
    eventId: string,
  ): Promise<boolean> {
    const onChainBalance = await this.stellar.queryContractBalance(escrowPaymentId);

    if (onChainBalance === null) {
      // Could not query — log a warning but allow processing to continue so
      // a transient RPC failure does not permanently block confirmation.
      this.logger.warn(
        `Balance query unavailable for payment ${payment.reference} (escrowId=${escrowPaymentId}); proceeding without verification`,
      );
      return false;
    }

    // Expected amount in stroops: amountUsdc is stored as a decimal number of
    // USDC units; 1 USDC = 10_000_000 stroops (7 decimal places on Stellar).
    const expectedStroops = BigInt(
      Math.round(Number(payment.amountUsdc ?? 0) * 10_000_000),
    );

    if (onChainBalance < expectedStroops) {
      const discrepancy = expectedStroops - onChainBalance;
      const message =
        `Short-paid deposit detected for payment ${payment.reference} ` +
        `(escrowId=${escrowPaymentId}): ` +
        `expected=${expectedStroops} stroops, ` +
        `on-chain=${onChainBalance} stroops, ` +
        `shortfall=${discrepancy} stroops`;

      this.logger.warn(message);

      Sentry.captureException(new Error(message), {
        tags: {
          component: 'soroban-monitor',
          event: 'short_paid_deposit',
        },
        extra: {
          paymentId: payment.id,
          reference: payment.reference,
          escrowPaymentId,
          eventId,
          expectedStroops: expectedStroops.toString(),
          onChainBalance: onChainBalance.toString(),
          discrepancyStroops: discrepancy.toString(),
        },
      });

      await this.adminAlerts.raise({
        type: AdminAlertType.STELLAR_MONITOR,
        dedupeKey: `soroban-monitor.short-paid:${payment.id}`,
        message,
        metadata: {
          paymentId: payment.id,
          reference: payment.reference,
          escrowPaymentId,
          expectedStroops: expectedStroops.toString(),
          onChainBalance: onChainBalance.toString(),
        },
        thresholdValue: 1,
      });

      return true; // short-paid — do not confirm
    }

    return false; // balance OK
  }

  private extractTopic(topics: string[]): EscrowEventTopic | null {
    const first = topics?.[1] ?? topics?.[0];
    if (typeof first !== 'string') return null;
    const normalized = first.toLowerCase();
    if (
      normalized === 'deposit' ||
      normalized === 'release' ||
      normalized === 'refund' ||
      normalized === 'expired' ||
      normalized === 'dispute'
    ) {
      return normalized;
    }
    return null;
  }

  private normalizePayload(value: unknown): EscrowEventPayload {
    if (typeof value === 'object' && value !== null) {
      return value as EscrowEventPayload;
    }
    return {};
  }

  private matchesEscrowPaymentId(payment: Payment, paymentId: string): boolean {
    const metadataId = payment.metadata?.escrowPaymentId;
    return metadataId === paymentId || payment.reference === paymentId;
  }

  private mapTopicToStatus(topic: EscrowEventTopic): PaymentStatus | null {
    switch (topic) {
      case 'deposit':
        return PaymentStatus.CONFIRMED;
      case 'release':
        return PaymentStatus.SETTLED;
      case 'refund':
        return PaymentStatus.REFUNDED;
      case 'expired':
        return PaymentStatus.EXPIRED;
      case 'dispute':
        return PaymentStatus.FAILED;
      default:
        return null;
    }
  }

  private extractAmount(value: EscrowEventPayload): number | null {
    const raw = value.amount;
    if (raw === undefined || raw === null) return null;
    return Number(raw);
  }

  private async getEvents(): Promise<SorobanEventsResponse> {
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'getEvents',
      params: {
        startLedger: this.startLedger || undefined,
        filters: [
          {
            type: 'contract',
            contractIds: [this.escrowContractId],
            topics: [['ESCROW', '*']],
          },
        ],
        pagination: { limit: 200 },
      },
    };

    const res = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Soroban RPC HTTP ${res.status}: ${await res.text()}`);
    }

    const json = (await res.json()) as any;
    if (json.error) {
      throw new Error(`Soroban RPC error: ${JSON.stringify(json.error)}`);
    }

    return {
      events: json.result?.events ?? [],
      latestLedger: json.result?.latestLedger ?? 0,
    };
  }
}
