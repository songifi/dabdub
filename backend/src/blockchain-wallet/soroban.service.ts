import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ── Events ────────────────────────────────────────────────────────────────────

export interface ContractPausedEvent {
  type: 'ContractPaused';
  admin: string;
  timestamp: Date;
}

export interface ContractUnpausedEvent {
  type: 'ContractUnpaused';
  admin: string;
  timestamp: Date;
}

export type ContractEvent = ContractPausedEvent | ContractUnpausedEvent;

// ── Errors ────────────────────────────────────────────────────────────────────

/**
 * Thrown when a state-changing operation is attempted while the contract
 * is paused. Maps to HTTP 403 if surfaced through a controller.
 */
export class ContractPausedError extends ForbiddenException {
  constructor() {
    super('ContractPaused: all state-changing operations are currently halted');
  }
}

/**
 * Thrown when a reentrant call is detected.
 * Maps to HTTP 409 if surfaced through a controller.
 */
export class ReentrantCallError extends Error {
  constructor() {
    super('ReentrantCall: escrow operation already in progress');
    this.name = 'ReentrantCallError';
  }
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * SorobanService wraps the CheesePay Soroban smart contract.
 *
 * ## Global pause switch
 * An admin can call pause() to instantly halt all deposits, releases, and
 * refunds during a security incident. View functions (getBalance,
 * getStakeBalance) remain callable while paused so monitoring is unaffected.
 *
 * The `paused` flag mirrors a persistent storage key in the real Soroban
 * contract. pause() / unpause() emit ContractPaused / ContractUnpaused events
 * that can be forwarded to an audit log or alert system.
 *
 * ## Reentrancy guard
 * A mutex-style `locked` flag prevents cross-contract reentrant calls from
 * exploiting the escrow release flow (separate concern, both guards coexist).
 */
@Injectable()
export class SorobanService {
  private readonly logger = new Logger(SorobanService.name);

  // Persistent storage flag — true while contract is paused by admin.
  // In the real Soroban contract this is a DataKey::Paused storage entry.
  private paused = false;

  // Reentrancy mutex — true while any escrow-mutating operation is running.
  // In a real Soroban contract this would be a temporary storage key.
  private locked = false;

  // In-memory event log (replace with persistent audit log / event bus in prod).
  private readonly eventLog: ContractEvent[] = [];

  constructor(private readonly configService: ConfigService) {}

  // ── Admin: pause / unpause ────────────────────────────────────────────────

  /**
   * Halts all state-changing contract operations immediately.
   * Idempotent — no duplicate events on repeated calls.
   * Emits ContractPaused event.
   */
  pause(adminId: string): void {
    if (this.paused) {
      this.logger.warn(`pause() called by ${adminId} but contract is already paused`);
      return;
    }

    this.paused = true;

    const event: ContractPausedEvent = {
      type: 'ContractPaused',
      admin: adminId,
      timestamp: new Date(),
    };
    this.eventLog.push(event);
    this.logger.warn(`CONTRACT PAUSED by admin ${adminId}`);
  }

  /**
   * Resumes normal contract operations.
   * Idempotent — no duplicate events on repeated calls.
   * Emits ContractUnpaused event.
   */
  unpause(adminId: string): void {
    if (!this.paused) {
      this.logger.warn(`unpause() called by ${adminId} but contract is not paused`);
      return;
    }

    this.paused = false;

    const event: ContractUnpausedEvent = {
      type: 'ContractUnpaused',
      admin: adminId,
      timestamp: new Date(),
    };
    this.eventLog.push(event);
    this.logger.log(`Contract unpaused by admin ${adminId}`);
  }

  // ── View: pause state (always accessible) ────────────────────────────────

  isPaused(): boolean {
    return this.paused;
  }

  getEventLog(): ContractEvent[] {
    return [...this.eventLog];
  }

  // ── Guards (private) ──────────────────────────────────────────────────────

  private requireNotPaused(): void {
    if (this.paused) {
      throw new ContractPausedError();
    }
  }

  private acquireLock(): void {
    if (this.locked) {
      throw new ReentrantCallError();
    }
    this.locked = true;
  }

  private releaseLock(): void {
    this.locked = false;
  }

  // ── Escrow: mutable operations (pause-guarded + reentrancy-guarded) ───────

  /**
   * Deposit funds into the escrow contract.
   * Blocked while paused. Blocked if reentrant.
   */
  async deposit(stellarAddress: string, amountUsdc: string): Promise<void> {
    this.requireNotPaused();
    this.acquireLock();
    try {
      this.logger.log(`Depositing ${amountUsdc} USDC from ${stellarAddress} into escrow`);
      // TODO: invoke CheesePay contract deposit(stellarAddress, amountUsdc)
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Release escrowed funds to the merchant.
   * Blocked while paused. Blocked if reentrant.
   */
  async release(paymentId: string, merchantAddress: string): Promise<void> {
    this.requireNotPaused();
    this.acquireLock();
    try {
      this.logger.log(`Releasing escrow for payment ${paymentId} → ${merchantAddress}`);
      // TODO: invoke CheesePay contract release(paymentId, merchantAddress)
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Refund escrowed funds back to the customer.
   * Blocked while paused. Blocked if reentrant.
   */
  async refund(paymentId: string, customerAddress: string): Promise<void> {
    this.requireNotPaused();
    this.acquireLock();
    try {
      this.logger.log(`Refunding escrow for payment ${paymentId} → ${customerAddress}`);
      // TODO: invoke CheesePay contract refund(paymentId, customerAddress)
    } finally {
      this.releaseLock();
    }
  }

  // ── Read-only contract calls (no pause guard — always accessible) ─────────

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
