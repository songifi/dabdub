import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { VirtualAccount } from '../../virtual-account/entities/virtual-account.entity';

export enum DepositStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('deposits')
export class Deposit extends BaseEntity {
  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'virtual_account_id' })
  virtualAccountId!: string;

  @ManyToOne(() => VirtualAccount)
  @JoinColumn({ name: 'virtual_account_id' })
  virtualAccount!: VirtualAccount;

  @Column({ name: 'ngn_amount', type: 'decimal', precision: 15, scale: 2 })
  ngnAmount!: number;

  @Column({ name: 'usdc_amount', type: 'decimal', precision: 15, scale: 6 })
  usdcAmount!: number;

  @Column({ name: 'reference', length: 100 })
  reference!: string;

  @Column({ type: 'enum', enum: DepositStatus, default: DepositStatus.PENDING })
  status!: DepositStatus;

  @Column({ name: 'flutterwave_reference', length: 100, nullable: true })
  flutterwaveReference!: string | null;
}