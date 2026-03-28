import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Worker } from 'bull';
import { CacheService } from '../../cache/cache.service';
import { SorobanService } from '../soroban.service';
import { ContractEventLog, ContractEventType, ReconciliationAlert } from '../entities';
import { User } from '../../users/entities/user.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { PayLink } from '../../paylink/entities/paylink.entity';

// Event types that the contract emits
interface SorobanEvent {
  id: string;
  txHash: string;
  eventIndex: number;
  type: string;
  ledger: number;
  data: Record<string, unknown>;
}

interface DepositEvent {
  username: string;
  amount: string;
  balance: string;
}

interface TransferEvent {
  from: string;
  to: string;
  amount: string;
  fromBalance: string;
  toBalance: string;
  note?: string;
}

interface PayLinkPaidEvent {
  payer: string;
  payLinkId: string;
  amount: string;
}

interface YieldCreditedEvent {
  username: string;
  yield: string;
  newBalance: string;
}

interface WithdrawalEvent {
  username: string;
  amount: string;
  txHash: string;
  balance: string;
}

/**
 * ContractEventListenerService
 *
 * Listens to Soroban contract events and syncs them to the database.
 * Provides reliable event-driven backup to direct API calls.
 */
@Injectable()
export class ContractEventListenerService {
  private readonly logger = new Logger(ContractEventListenerService.name);

  private readonly LAST_LEDGER_KEY = 'contract:last_ledger';
  private readonly PROCESSED_EVENTS_KEY = 'contract:events:processed';
  private readonly EVENT_CACHE_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

  constructor(
    @InjectRepository(ContractEventLog)
    private readonly eventLogRepo: Repository<ContractEventLog>,

    @InjectRepository(ReconciliationAlert)
    private readonly reconciliationAlertRepo: Repository<ReconciliationAlert>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,

    @InjectRepository(PayLink)
    private readonly payLinkRepo: Repository<PayLink>,

    @InjectQueue('blockchain-sync')
    private readonly q: Queue,

    private readonly cacheService: CacheService,
    private readonly sorobanService: SorobanService,
  ) {}

  /**
   * Start the contract event listener job (runs every 60 seconds)
   */
  async startListener(): Promise<void> {
    await this.q.add(
      'contract-event-listener',
      {},
      {
        repeat: {
          every: 60000, // 60 seconds
        },
      },
    );

    // Create worker to process jobs
    const worker = new Worker('blockchain-sync', async () => {
      await this.pollContractEvents();
    });

    worker.on('completed', (job) => {
      this.logger.log(`Contract event listener job completed: ${job.id}`);
    });

    worker.on('failed', (job, err) => {
      this.logger.error(
        `Contract event listener job failed: ${job?.id} - ${err.message}`,
        err.stack,
      );
    });
  }

  /**
   * Poll contract for events since last processed ledger
   */
  async pollContractEvents(): Promise<void> {
    try {
      this.logger.debug('Starting contract event polling...');

      // Get last processed ledger from Redis
      const lastLedger = await this.getLastProcessedLedger();

      // Fetch events from Stellar RPC (currentLedger - lastLedger)
      const events = await this.fetchContractEvents(lastLedger);

      if (events.length === 0) {
        this.logger.debug('No new contract events');
        return;
      }

      this.logger.log(`Processing ${events.length} contract events`);

      for (const event of events) {
        await this.processEvent(event);
      }

      // Update last processed ledger
      if (events.length > 0) {
        const maxLedger = Math.max(...events.map((e) => e.ledger));
        await this.setLastProcessedLedger(maxLedger);
      }
    } catch (error) {
      this.logger.error(
        `Contract event listener error: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Process a single contract event
   */
  private async processEvent(event: SorobanEvent): Promise<void> {
    const eventKey = `${event.txHash}:${event.eventIndex}`;

    // Check idempotency: skip if already processed
    const isProcessed = await this.cacheService.get(`${this.PROCESSED_EVENTS_KEY}:${eventKey}`);
    if (isProcessed) {
      this.logger.debug(`Skipping already-processed event: ${eventKey}`);
      return;
    }

    try {
      // Determine event type and handle accordingly
      const eventType = this.parseEventType(event.type);

      switch (eventType) {
        case ContractEventType.DEPOSIT:
          await this.handleDepositEvent(event, eventType);
          break;
        case ContractEventType.TRANSFER:
          await this.handleTransferEvent(event, eventType);
          break;
        case ContractEventType.PAYLINK_PAID:
          await this.handlePayLinkPaidEvent(event, eventType);
          break;
        case ContractEventType.YIELD_CREDITED:
          await this.handleYieldCreditedEvent(event, eventType);
          break;
        case ContractEventType.WITHDRAWAL:
          await this.handleWithdrawalEvent(event, eventType);
          break;
        default:
          this.logger.warn(`Unknown event type: ${event.type}`);
      }

      // Mark event as processed
      await this.markEventProcessed(eventKey);

      // Log event
      await this.eventLogRepo.save({
        txHash: event.txHash,
        eventIndex: event.eventIndex,
        eventType,
        data: event.data,
        ledger: event.ledger,
      });

      this.logger.log(`Processed ${eventType} event: ${eventKey}`);
    } catch (error) {
      this.logger.error(
        `Error processing event ${eventKey}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private parseEventType(type: string): ContractEventType {
    const typeMap: Record<string, ContractEventType> = {
      deposit: ContractEventType.DEPOSIT,
      transfer: ContractEventType.TRANSFER,
      paylink_paid: ContractEventType.PAYLINK_PAID,
      yield_credited: ContractEventType.YIELD_CREDITED,
      withdrawal: ContractEventType.WITHDRAWAL,
    };
    return typeMap[type] || ContractEventType.DEPOSIT;
  }

  /**
   * Handle deposit event: sync balance + create Transaction if missing
   */
  private async handleDepositEvent(event: SorobanEvent, eventType: ContractEventType): Promise<void> {
    const data = event.data as DepositEvent;
    const user = await this.userRepo.findOne({ where: { username: data.username } });

    if (!user) {
      await this.createReconciliationAlert(
        '',
        'missing_user',
        `Deposit event for unknown user: ${data.username}`,
        { event: data },
      );
      return;
    }

    // Check balance mismatch
    const contractBalance = parseFloat(data.balance);
    // TODO: compare with user.balance if storing on-chain balances

    // Create Transaction if missing
    const existingTx = await this.transactionRepo.findOne({
      where: { referenceId: event.txHash },
    });

    if (!existingTx) {
      // Create new transaction record
      this.logger.log(
        `Creating Transaction for deposit: user=${data.username}, amount=${data.amount}`,
      );
      // TODO: Create transaction via TransactionService
    }
  }

  /**
   * Handle transfer event: sync both balances + verify record matches
   */
  private async handleTransferEvent(event: SorobanEvent, eventType: ContractEventType): Promise<void> {
    const data = event.data as TransferEvent;

    const [from, to] = await Promise.all([
      this.userRepo.findOne({ where: { username: data.from } }),
      this.userRepo.findOne({ where: { username: data.to } }),
    ]);

    if (!from || !to) {
      await this.createReconciliationAlert(
        '',
        'missing_user_transfer',
        `Transfer between ${data.from} and ${data.to} - one or both users not found`,
        { event: data },
      );
      return;
    }

    // Verify matching transaction exists
    const existingTx = await this.transactionRepo.findOne({
      where: { referenceId: event.txHash },
    });

    if (!existingTx) {
      this.logger.log(
        `Creating Transaction for transfer: ${data.from} → ${data.to}, amount=${data.amount}`,
      );
      // TODO: Create transaction via TransactionService
    }
  }

  /**
   * Handle paylink_paid event: update PayLink status
   */
  private async handlePayLinkPaidEvent(event: SorobanEvent, eventType: ContractEventType): Promise<void> {
    const data = event.data as PayLinkPaidEvent;

    const payLink = await this.payLinkRepo.findOne({
      where: { id: data.payLinkId },
    });

    if (!payLink) {
      await this.createReconciliationAlert(
        '',
        'missing_paylink',
        `PayLink paid event for unknown PayLink: ${data.payLinkId}`,
        { event: data },
      );
      return;
    }

    // TODO: Update PayLink status to paid if not already
    this.logger.log(`PayLink paid: ${data.payLinkId} by ${data.payer}`);
  }

  /**
   * Handle yield_credited event: create YieldEntry if missing
   */
  private async handleYieldCreditedEvent(event: SorobanEvent, eventType: ContractEventType): Promise<void> {
    const data = event.data as YieldCreditedEvent;

    const user = await this.userRepo.findOne({
      where: { username: data.username },
    });

    if (!user) {
      await this.createReconciliationAlert(
        '',
        'missing_user',
        `Yield credited event for unknown user: ${data.username}`,
        { event: data },
      );
      return;
    }

    // TODO: Create YieldEntry if missing via EarningsService
    this.logger.log(`Yield credited to user: ${data.username}, yield=${data.yield}`);
  }

  /**
   * Handle withdrawal event: update Withdrawal status
   */
  private async handleWithdrawalEvent(event: SorobanEvent, eventType: ContractEventType): Promise<void> {
    const data = event.data as WithdrawalEvent;

    const user = await this.userRepo.findOne({
      where: { username: data.username },
    });

    if (!user) {
      await this.createReconciliationAlert(
        '',
        'missing_user',
        `Withdrawal event for unknown user: ${data.username}`,
        { event: data },
      );
      return;
    }

    // TODO: Update withdrawal transaction status if exists
    this.logger.log(
      `Withdrawal processed: user=${data.username}, amount=${data.amount}, tx=${data.txHash}`,
    );
  }

  /**
   * Create a reconciliation alert for balance mismatches or missing records
   */
  private async createReconciliationAlert(
    userId: string,
    discrepancyType: string,
    message: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const alert = this.reconciliationAlertRepo.create({
      userId: userId || 'system',
      discrepancyType,
      message,
      data,
    });

    await this.reconciliationAlertRepo.save(alert);
    this.logger.warn(`Reconciliation alert created: ${discrepancyType} - ${message}`);
    // TODO: Send notification to admins
  }

  /**
   * Fetch events from Stellar RPC since lastLedger
   */
  private async fetchContractEvents(fromLedger: number): Promise<SorobanEvent[]> {
    // TODO: Call Soroban RPC getEvents
    // This is a placeholder - actual implementation depends on Stellar SDK version
    try {
      // const events = await this.sorobanService.server.getEvents({
      //   contractIds: [this.sorobanService.contractClient.contractId],
      //   startLedger: fromLedger,
      // });

      // For now, return empty array
      return [];
    } catch (error) {
      this.logger.error(`Error fetching contract events: ${error}`);
      return [];
    }
  }

  /**
   * Get last processed ledger from Redis
   */
  private async getLastProcessedLedger(): Promise<number> {
    const ledger = await this.cacheService.get<number>(this.LAST_LEDGER_KEY);
    return ledger || 0; // Start from beginning if not set
  }

  /**
   * Set last processed ledger in Redis
   */
  private async setLastProcessedLedger(ledger: number): Promise<void> {
    await this.cacheService.set(this.LAST_LEDGER_KEY, ledger, 24 * 60 * 60); // 24h TTL
  }

  /**
   * Mark event as processed (idempotency)
   */
  private async markEventProcessed(eventKey: string): Promise<void> {
    await this.cacheService.set(
      `${this.PROCESSED_EVENTS_KEY}:${eventKey}`,
      true,
      this.EVENT_CACHE_TTL,
    );
  }

  /**
   * Get all contract events (admin endpoint)
   */
  async getContractEvents(
    page: number = 1,
    limit: number = 20,
    eventType?: ContractEventType,
  ): Promise<{
    data: ContractEventLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    const query = this.eventLogRepo.createQueryBuilder('event');

    if (eventType) {
      query.where('event.eventType = :eventType', { eventType });
    }

    const [data, total] = await query
      .orderBy('event.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  /**
   * Get reconciliation alerts (admin endpoint)
   */
  async getReconciliationAlerts(
    page: number = 1,
    limit: number = 20,
    unresolved: boolean = true,
  ): Promise<{
    data: ReconciliationAlert[];
    total: number;
    page: number;
    limit: number;
  }> {
    const query = this.reconciliationAlertRepo.createQueryBuilder('alert');

    if (unresolved) {
      query.where('alert.isResolved = :isResolved', { isResolved: false });
    }

    const [data, total] = await query
      .orderBy('alert.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  /**
   * Resolve a reconciliation alert
   */
  async resolveAlert(alertId: string, resolvedNote: string): Promise<void> {
    await this.reconciliationAlertRepo.update(
      { id: alertId },
      { isResolved: true, resolvedNote },
    );
  }
}
