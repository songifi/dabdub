import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Custom error thrown when a reentrant call is detected.
 * Maps to HTTP 409 if surfaced through a controller.
 */
export class ReentrantCallError extends Error {
  constructor() {
    super('ReentrantCall: escrow operation already in progress');
    this.name = 'ReentrantCallError';
  }
}

/**
 * SorobanService wraps the CheesePay Soroban smart contract.
 *
 * Security: a mutex-style `locked` flag guards deposit(), release(), and
 * refund() against reentrant calls. If a cross-contract callback tries to
 * re-enter any of those methods while one is already executing, a
 * ReentrantCallError is thrown immediately — before any state changes occur.
 *
 * The pattern mirrors the checks-effects-interactions guard used in Solidity
 * and the storage-flag approach available in Soroban's temporary storage.
 */
@Injectable()
export class SorobanService {
  private readonly logger = new Logger(SorobanService.name);

  // Mutex flag — true while any escrow-mutating operation is running.
  // In a real Soroban contract this would be a temporary storage key.
  private locked = false;

  constructor(private readonly configService: ConfigService) {}

  // ── Reentrancy guard helpers ────────────────────────────────────────────────

  private acquireLock(): void {
    if (this.locked) {
      throw new ReentrantCallError();
    }
    this.locked = true;
  }

  private releaseLock(): void {
    this.locked = false;
  }

  // ── Escrow operations (guarded) ─────────────────────────────────────────────

  /**
   * Deposit funds into the escrow contract.
   * Guarded: rejects if called while another escrow operation is in flight.
   */
  async deposit(stellarAddress: string, amountUsdc: string): Promise<void> {
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
   * Guarded: rejects if called while another escrow operation is in flight.
   */
  async release(paymentId: string, merchantAddress: string): Promise<void> {
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
   * Guarded: rejects if called while another escrow operation is in flight.
   */
  async refund(paymentId: string, customerAddress: string): Promise<void> {
    this.acquireLock();
    try {
      this.logger.log(`Refunding escrow for payment ${paymentId} → ${customerAddress}`);
      // TODO: invoke CheesePay contract refund(paymentId, customerAddress)
    } finally {
      this.releaseLock();
    }
  }

  // ── Read-only contract calls (no guard needed) ──────────────────────────────

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
}
