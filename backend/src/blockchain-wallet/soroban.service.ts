import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ── Errors ────────────────────────────────────────────────────────────────────

/**
 * Thrown when confirm() is called on a payment whose expiry_ledger has passed.
 * Maps to HTTP 410 Gone — the payment window is permanently closed.
 */
export class PaymentExpiredError extends Error {
  readonly paymentId: string;
  readonly expiryLedger: number;
  readonly currentLedger: number;

  constructor(paymentId: string, expiryLedger: number, currentLedger: number) {
    super(
      `PaymentExpired: payment ${paymentId} expired at ledger ${expiryLedger} ` +
      `(current ledger: ${currentLedger})`,
    );
    this.name = 'PaymentExpiredError';
    this.paymentId = paymentId;
    this.expiryLedger = expiryLedger;
    this.currentLedger = currentLedger;
  }
}

// ── Events ────────────────────────────────────────────────────────────────────

export interface PaymentExpiredEvent {
  type: 'PaymentExpired';
  paymentId: string;
  expiryLedger: number;
  ledgerAtExpiry: number;
  refundInstruction: {
    /** Return funds to this address if a deposit was already received */
    returnToAddress: string | null;
    amountUsdc: string;
  };
  timestamp: Date;
}

// ── Payment record stored in contract persistent storage ──────────────────────

export interface ContractPayment {
  id: string;
  merchantAddress: string;
  amountUsdc: string;
  /** Ledger sequence number after which this payment cannot be confirmed */
  expiryLedger: number;
  status: 'pending' | 'confirmed' | 'expired' | 'refunded';
  customerAddress: string | null;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * SorobanService wraps the CheesePay Soroban smart contract.
 *
 * ## Ledger-based payment expiry
 * Each payment stores an `expiry_ledger: u32`. confirm() checks
 * `env.ledger().sequence() > expiry_ledger` and reverts with
 * PaymentExpiredError if the window has passed — regardless of NestJS state.
 * This makes expiry deterministic and tamper-proof: wall-clock drift,
 * NestJS delays, or a stuck cron cannot resurrect an expired payment.
 *
 * expire_payment(id) is provided for the NestJS cron to call explicitly,
 * emitting a PaymentExpired event with refund instructions.
 *
 * ## Ledger sequence approximation
 * Stellar closes ~1 ledger every 5 seconds. The default expiry window is
 * 360 ledgers ≈ 30 minutes. Callers can override via expiryLedgers param.
 */
@Injectable()
export class SorobanService {
  private readonly logger = new Logger(SorobanService.name);

  /** Approximate ledgers per minute on Stellar (1 ledger ≈ 5 s) */
  static readonly LEDGERS_PER_MINUTE = 12;
  /** Default expiry window: 30 minutes = 360 ledgers */
  static readonly DEFAULT_EXPIRY_LEDGERS = 360;

  // In-memory contract storage — mirrors Soroban persistent storage.
  // In production this is the actual on-chain contract state.
  private readonly payments = new Map<string, ContractPayment>();
  private readonly eventLog: PaymentExpiredEvent[] = [];

  // Simulated current ledger sequence — injected in tests for determinism.
  private _currentLedger = 1000;

  constructor(private readonly configService: ConfigService) {}

  // ── Ledger helpers ────────────────────────────────────────────────────────

  /**
   * Returns the current ledger sequence.
   * Mirrors env.ledger().sequence() in the Soroban contract.
   * Overridable in tests via setCurrentLedger().
   */
  getCurrentLedger(): number {
    return this._currentLedger;
  }

  /** Test helper — simulates ledger advancement without real network calls. */
  setCurrentLedger(sequence: number): void {
    this._currentLedger = sequence;
  }

  /** Advance the simulated ledger by n (test helper). */
  advanceLedger(n: number): void {
    this._currentLedger += n;
  }

  // ── Contract: create payment with expiry_ledger ───────────────────────────

  /**
   * Store a new payment in contract persistent storage.
   * expiry_ledger = current_ledger + expiryLedgers (default 360 ≈ 30 min).
   */
  createPayment(
    id: string,
    merchantAddress: string,
    amountUsdc: string,
    expiryLedgers = SorobanService.DEFAULT_EXPIRY_LEDGERS,
  ): ContractPayment {
    const expiryLedger = this.getCurrentLedger() + expiryLedgers;

    const payment: ContractPayment = {
      id,
      merchantAddress,
      amountUsdc,
      expiryLedger,
      status: 'pending',
      customerAddress: null,
    };

    this.payments.set(id, payment);
    this.logger.log(
      `Payment ${id} created — expires at ledger ${expiryLedger} ` +
      `(current: ${this.getCurrentLedger()})`,
    );
    return payment;
  }

  // ── Contract: confirm() — reverts if expired ──────────────────────────────

  /**
   * Confirm a payment. Reverts with PaymentExpiredError if the current ledger
   * sequence has passed expiry_ledger — mirrors the Soroban contract check:
   *
   *   if env.ledger().sequence() > expiry_ledger {
   *     return Err(ContractError::PaymentExpired)
   *   }
   */
  async confirm(paymentId: string, customerAddress: string): Promise<void> {
    const payment = this.requirePayment(paymentId);

    // ── Expiry check — must happen before any state mutation ─────────────────
    const currentLedger = this.getCurrentLedger();
    if (currentLedger > payment.expiryLedger) {
      throw new PaymentExpiredError(paymentId, payment.expiryLedger, currentLedger);
    }

    if (payment.status !== 'pending') {
      throw new Error(`Payment ${paymentId} is not pending (status: ${payment.status})`);
    }

    payment.status = 'confirmed';
    payment.customerAddress = customerAddress;
    this.logger.log(
      `Payment ${paymentId} confirmed by ${customerAddress} at ledger ${currentLedger}`,
    );
  }

  // ── Contract: expire_payment() — called by NestJS cron ───────────────────

  /**
   * Explicitly expire a payment and emit a PaymentExpired event with refund
   * instructions. Called by the NestJS cron job for payments past their
   * expiry_ledger. Idempotent — safe to call multiple times.
   *
   * Mirrors the Soroban contract expire_payment(env, id) entry point.
   */
  async expirePayment(paymentId: string): Promise<PaymentExpiredEvent | null> {
    const payment = this.requirePayment(paymentId);

    // Already expired or in a terminal state — nothing to do
    if (payment.status === 'expired') {
      this.logger.debug(`Payment ${paymentId} already expired — skipping`);
      return null;
    }

    if (payment.status !== 'pending') {
      this.logger.debug(
        `expire_payment called on ${paymentId} with status=${payment.status} — skipping`,
      );
      return null;
    }

    const currentLedger = this.getCurrentLedger();
    if (currentLedger <= payment.expiryLedger) {
      this.logger.debug(
        `Payment ${paymentId} not yet expired ` +
        `(expiry: ${payment.expiryLedger}, current: ${currentLedger})`,
      );
      return null;
    }

    payment.status = 'expired';

    const event: PaymentExpiredEvent = {
      type: 'PaymentExpired',
      paymentId,
      expiryLedger: payment.expiryLedger,
      ledgerAtExpiry: currentLedger,
      refundInstruction: {
        returnToAddress: payment.customerAddress,
        amountUsdc: payment.amountUsdc,
      },
      timestamp: new Date(),
    };

    this.eventLog.push(event);
    this.logger.warn(
      `PaymentExpired: ${paymentId} expired at ledger ${payment.expiryLedger} ` +
      `(current: ${currentLedger})`,
    );

    return event;
  }

  // ── View: read contract state (no expiry guard — always accessible) ────────

  getPayment(id: string): ContractPayment | undefined {
    return this.payments.get(id);
  }

  getExpiredEventLog(): PaymentExpiredEvent[] {
    return [...this.eventLog];
  }

  isExpired(paymentId: string): boolean {
    const payment = this.payments.get(paymentId);
    if (!payment) return false;
    return this.getCurrentLedger() > payment.expiryLedger;
  }

  // ── Existing contract entry points ────────────────────────────────────────

  async registerUser(username: string, publicKey: string): Promise<void> {
    this.logger.log(`Registering user ${username} (${publicKey}) on Soroban contract`);
    // TODO: invoke CheesePay contract registerUser(username, publicKey)
  }

  async getBalance(stellarAddress: string): Promise<string> {
    this.logger.log(`Fetching USDC balance for ${stellarAddress}`);
    // TODO: invoke CheesePay contract getBalance(stellarAddress)
    return '0';
  }

  async getStakeBalance(stellarAddress: string): Promise<string> {
    this.logger.log(`Fetching stake balance for ${stellarAddress}`);
    // TODO: invoke CheesePay contract getStakeBalance(stellarAddress)
    return '0';
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private requirePayment(id: string): ContractPayment {
    const payment = this.payments.get(id);
    if (!payment) throw new Error(`Payment ${id} not found in contract storage`);
    return payment;
  }
}
