import { Entity, Column, Index, CreateDateColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum ContractEventType {
  DEPOSIT = 'deposit',
  TRANSFER = 'transfer',
  PAYLINK_PAID = 'paylink_paid',
  YIELD_CREDITED = 'yield_credited',
  WITHDRAWAL = 'withdrawal',
}

/**
 * ContractEventLog
 *
 * Immutable audit trail of all Soroban contract events received.
 * Enables blockchain-sourced event tracking and reconciliation.
 */
@Entity('contract_event_logs')
@Index('IDX_contract_event_logs_tx_hash_event_index', { synchronize: false }, ['txHash', 'eventIndex'], { unique: true })
@Index('IDX_contract_event_logs_event_type', { synchronize: false }, ['eventType'])
@Index('IDX_contract_event_logs_ledger', { synchronize: false }, ['ledger'])
@Index('IDX_contract_event_logs_processed_at', { synchronize: false }, ['processedAt'])
export class ContractEventLog extends BaseEntity {
  @Column()
  txHash!: string;

  @Column({ name: 'event_index' })
  eventIndex!: number;

  @Column({
    type: 'enum',
    enum: ContractEventType,
  })
  eventType!: ContractEventType;

  @Column({ type: 'jsonb', nullable: false })
  data!: Record<string, unknown>;

  @Column()
  ledger!: number;

  @CreateDateColumn()
  processedAt!: Date;
}
