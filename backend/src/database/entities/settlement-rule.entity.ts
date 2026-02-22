import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

export interface SettlementCondition {
  field: 'merchant.tier' | 'transaction.usdAmount' | 'transaction.chain' | 'merchant.settlementCurrency' | 'merchant.country';
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'not_in';
  value: string | number | string[];
}

export interface SettlementAction {
  liquidityProvider?: string; // Override which provider to use
  settlementDelay?: number; // Hours to wait before settling
  batchWith?: 'SAME_CURRENCY' | 'SAME_MERCHANT' | 'IMMEDIATE';
  requireManualApproval?: boolean; // Flag for manual review
  minimumBatchAmount?: number;
}

@Entity('settlement_rules')
export class SettlementRule extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'int' })
  priority: number; // Lower = evaluated first

  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  @Column({ type: 'jsonb' })
  conditions: SettlementCondition[];

  @Column({ type: 'jsonb' })
  actions: SettlementAction;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ nullable: true })
  createdById: string;
}
