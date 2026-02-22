import {
  Entity,
  Column,
} from 'typeorm';
import { BaseEntity } from './base.entity';

export interface WebhookTestEntry {
  event: string;
  payload: Record<string, unknown>;
  responseStatus: number;
  responseBody: string;
  responseHeaders: Record<string, string>;
  responseTimeMs: number;
  timestamp: Date;
}

@Entity('sandbox_merchant_configs')
export class SandboxMerchantConfig extends BaseEntity {
  @Column({ name: 'merchant_id', unique: true })
  merchantId: string;

  @Column({ name: 'sandbox_enabled', type: 'boolean', default: true })
  sandboxEnabled: boolean;

  @Column({
    name: 'sandbox_balance',
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: '10000',
  })
  sandboxBalance: string; // virtual balance for testing

  @Column({ name: 'auto_confirm_transactions', type: 'boolean', default: false })
  autoConfirmTransactions: boolean;
  // If true: sandbox transactions auto-confirm without blockchain confirmation

  @Column({ name: 'simulated_confirmation_delay', type: 'int', default: 5 })
  simulatedConfirmationDelay: number; // seconds

  @Column({ name: 'simulate_random_failures', type: 'boolean', default: false })
  simulateRandomFailures: boolean;

  @Column({
    name: 'failure_rate',
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: '0.00',
  })
  failureRate: string; // 0.00–1.00, fraction of transactions to simulate as failed

  @Column({ name: 'webhook_test_history', type: 'jsonb', default: [] })
  webhookTestHistory: WebhookTestEntry[];
}
