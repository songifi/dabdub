import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Queue } from 'bull';
import { CacheService } from '../cache/cache.service';
import { DEFAULT_QUEUE_JOB, QUEUE_NAMES } from '../queues/queue.constants';
import {
  PaymentConfirmedEventDto,
  SettlementCompletedEventDto,
  SorobanContractEventDto,
  SorobanRpcEvent,
} from './soroban-event.dto';

interface SorobanEventsResponse {
  events: SorobanRpcEvent[];
  latestLedger: number;
}

const CURSOR_KEY = 'soroban:indexer:last-ledger';
const CURSOR_TTL_SECONDS = 60 * 60 * 24 * 365;
const PAGE_LIMIT = 200;

@Injectable()
export class SorobanEventIndexer {
  private readonly logger = new Logger(SorobanEventIndexer.name);
  private readonly rpcUrl: string;
  private readonly contractId: string;
  private polling = false;

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(QUEUE_NAMES.sorobanEventDlq) private readonly dlq: Queue,
  ) {
    this.rpcUrl = this.config.get<string>(
      'SOROBAN_RPC_URL',
      'https://soroban-testnet.stellar.org',
    );
    this.contractId = this.config.get<string>(
      'SOROBAN_CONTRACT_ID',
      this.config.get<string>('STELLAR_USDC_CONTRACT_ID', ''),
    );
  }

  @Cron('*/5 * * * * *')
  async pollEvents(): Promise<void> {
    if (this.polling) {
      this.logger.debug('Skipping poll: previous Soroban cycle still running');
      return;
    }

    if (!this.contractId) {
      this.logger.debug('SOROBAN_CONTRACT_ID not configured; skipping event indexing');
      return;
    }

    this.polling = true;
    try {
      const lastLedger = (await this.cache.get<number>(CURSOR_KEY)) ?? 0;
      let startLedger = lastLedger > 0 ? lastLedger + 1 : undefined;
      let latestSeenLedger = lastLedger;
      let pageCursor: string | undefined;

      while (true) {
        const { events, latestLedger } = await this.getEvents(startLedger, pageCursor);
        latestSeenLedger = Math.max(latestSeenLedger, latestLedger);

        if (!events.length) break;

        for (const event of events) {
          try {
            const dto = this.parseEvent(event);
            if (!dto) continue;
            await this.dispatch(dto);
            latestSeenLedger = Math.max(latestSeenLedger, event.ledger ?? latestSeenLedger);
          } catch (error) {
            await this.enqueueDeadLetter(event, error as Error);
          }
        }

        if (events.length < PAGE_LIMIT) break;
        pageCursor = events[events.length - 1]?.pagingToken;
        startLedger = undefined;
      }

      if (latestSeenLedger > lastLedger) {
        await this.cache.set(CURSOR_KEY, latestSeenLedger, {
          ttlSeconds: CURSOR_TTL_SECONDS,
        });
      }
    } finally {
      this.polling = false;
    }
  }

  private async dispatch(dto: SorobanContractEventDto): Promise<void> {
    if (dto.topic === 'payment.confirmed') {
      await this.eventEmitter.emitAsync('soroban.payment.confirmed', dto);
      return;
    }

    if (dto.topic === 'settlement.completed') {
      await this.eventEmitter.emitAsync('soroban.settlement.completed', dto);
    }
  }

  private parseEvent(raw: SorobanRpcEvent): SorobanContractEventDto | null {
    const [topic] = raw.topic ?? [];
    if (!topic) return null;

    if (topic === 'payment_confirmed') {
      return this.toPaymentConfirmedDto(raw);
    }

    if (topic === 'settlement_completed') {
      return this.toSettlementCompletedDto(raw);
    }

    return null;
  }

  private toPaymentConfirmedDto(raw: SorobanRpcEvent): PaymentConfirmedEventDto {
    const value = raw.value ?? {};
    const paymentReference = String(value.paymentReference ?? value.reference ?? '');
    const txHash = String(value.txHash ?? '');
    const amount = Number(value.amount ?? 0);
    const asset = String(value.asset ?? 'USDC');

    if (!paymentReference || !txHash || Number.isNaN(amount)) {
      throw new Error(`Invalid payment_confirmed event payload: ${JSON.stringify(raw.value)}`);
    }

    return {
      topic: 'payment.confirmed',
      eventId: raw.id,
      pagingToken: raw.pagingToken,
      ledger: raw.ledger,
      ledgerClosedAt: new Date(raw.ledgerClosedAt),
      contractId: raw.contractId,
      rawTopic: raw.topic,
      paymentReference,
      txHash,
      amount,
      asset,
      from: typeof value.from === 'string' ? value.from : undefined,
    };
  }

  private toSettlementCompletedDto(raw: SorobanRpcEvent): SettlementCompletedEventDto {
    const value = raw.value ?? {};
    const settlementId = String(value.settlementId ?? value.reference ?? '');
    const partnerReference =
      typeof value.partnerReference === 'string'
        ? value.partnerReference
        : undefined;

    if (!settlementId) {
      throw new Error(`Invalid settlement_completed event payload: ${JSON.stringify(raw.value)}`);
    }

    return {
      topic: 'settlement.completed',
      eventId: raw.id,
      pagingToken: raw.pagingToken,
      ledger: raw.ledger,
      ledgerClosedAt: new Date(raw.ledgerClosedAt),
      contractId: raw.contractId,
      rawTopic: raw.topic,
      settlementId,
      partnerReference,
    };
  }

  private async getEvents(
    startLedger?: number,
    cursor?: string,
  ): Promise<SorobanEventsResponse> {
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'getEvents',
      params: {
        startLedger,
        filters: [
          {
            type: 'contract',
            contractIds: [this.contractId],
          },
        ],
        pagination: {
          limit: PAGE_LIMIT,
          cursor,
        },
      },
    };

    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Soroban RPC HTTP ${response.status}: ${await response.text()}`);
    }

    const json = (await response.json()) as any;
    if (json.error) {
      throw new Error(`Soroban RPC error: ${JSON.stringify(json.error)}`);
    }

    return {
      events: json.result?.events ?? [],
      latestLedger: Number(json.result?.latestLedger ?? 0),
    };
  }

  private async enqueueDeadLetter(event: SorobanRpcEvent, error: Error): Promise<void> {
    this.logger.error(`Failed to process Soroban event ${event.id}: ${error.message}`);
    await this.dlq.add(DEFAULT_QUEUE_JOB, {
      source: 'soroban-indexer',
      event,
      error: error.message,
      failedAt: new Date().toISOString(),
    });
  }
}
