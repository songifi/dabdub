import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { AdminAlertService } from '../alerts/admin-alert.service';
import { AdminAlertType } from '../alerts/admin-alert.entity';

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

/**
 * SorobanMonitorService: subscribes to SEP-41 USDC transfer events on the
 * escrow contract as a secondary confirmation signal alongside the Horizon
 * transaction monitor. Used as a fallback if escrow events are missed.
 */
@Injectable()
export class SorobanMonitorService {
  private readonly logger = new Logger(SorobanMonitorService.name);
  private readonly processedEventIds = new Set<string>();
  private startLedger = 0;
  private rpcUrl: string;
  private usdcContractId: string;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepo: Repository<Payment>,
    private readonly config: ConfigService,
    private readonly adminAlerts: AdminAlertService,
  ) {
    this.rpcUrl = this.config.get<string>(
      'SOROBAN_RPC_URL',
      'https://soroban-testnet.stellar.org',
    );
    this.usdcContractId = this.config.get<string>(
      'STELLAR_USDC_CONTRACT_ID',
      '',
    );
  }

  /**
   * Poll Soroban RPC for USDC transfer events and correlate to pending payments.
   * Called by the Stellar monitor Bull job every 30 seconds.
   */
  async pollTransferEvents(): Promise<void> {
    if (!this.usdcContractId) {
      this.logger.debug('STELLAR_USDC_CONTRACT_ID not set — skipping Soroban event poll');
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

    const pendingPayments = await this.paymentsRepo.find({
      where: { status: PaymentStatus.PENDING },
    });

    if (!pendingPayments.length) return;

    for (const event of events) {
      // De-duplicate: skip already processed events
      if (this.processedEventIds.has(event.id)) continue;
      this.processedEventIds.add(event.id);

      // Keep de-dup set bounded to last 10 000 event IDs
      if (this.processedEventIds.size > 10_000) {
        const oldest = this.processedEventIds.values().next().value;
        this.processedEventIds.delete(oldest);
      }

      await this.processTransferEvent(event, pendingPayments);
    }
  }

  private async processTransferEvent(
    event: SorobanEvent,
    pendingPayments: Payment[],
  ): Promise<void> {
    // SEP-41 transfer event topics: ["transfer", from_address, to_address]
    // value: { amount: i128 }
    const topics = event.topic ?? [];
    if (topics.length < 3) return;

    const [topic, , toAddress] = topics;
    if (topic !== 'transfer') return;

    const depositAddress = this.config.get<string>('STELLAR_ACCOUNT_PUBLIC', '');
    if (!depositAddress || toAddress !== depositAddress) return;

    // Amount in i128 stroops (7 decimal places for USDC on Stellar)
    const rawAmount = this.extractAmount(event.value);
    if (rawAmount === null) return;

    const amountUsdc = rawAmount / 1e7;

    // Try to correlate with a pending payment by amount (best-effort fallback)
    const matched = pendingPayments.find(
      (p) => Math.abs(Number(p.amountUsdc ?? 0) - amountUsdc) < 0.000001,
    );

    if (!matched) {
      this.logger.debug(
        `Soroban USDC transfer of ${amountUsdc} USDC to ${toAddress} — no pending payment matched`,
      );
      return;
    }

    // Check that it wasn't already confirmed via Horizon (avoid double-processing)
    if (matched.status !== PaymentStatus.PENDING) return;

    this.logger.log(
      `Soroban fallback: matched USDC transfer ${amountUsdc} to payment ${matched.reference} (event ${event.id})`,
    );

    await this.adminAlerts.raise({
      type: AdminAlertType.STELLAR_MONITOR,
      dedupeKey: `soroban.fallback:${matched.id}`,
      message:
        `Soroban fallback match for payment ${matched.reference}: ` +
        `${amountUsdc} USDC transferred via token contract (event ${event.id}). ` +
        `Horizon monitor should confirm this shortly.`,
      metadata: {
        paymentId: matched.id,
        reference: matched.reference,
        amountUsdc,
        sorobanEventId: event.id,
      },
      thresholdValue: 1,
    });
  }

  private extractAmount(value: any): number | null {
    if (typeof value === 'number') return value;
    if (typeof value === 'object' && value !== null) {
      const raw = value.amount ?? value._amount ?? value.value;
      if (raw !== undefined) return Number(raw);
    }
    return null;
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
            contractIds: [this.usdcContractId],
            topics: [['transfer', '*', '*']],
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
