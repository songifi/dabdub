import {
  CreateDateColumn,
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FeeType } from '../../fee-config/entities/fee-config.entity';

@Entity('fee_records')
export class FeeRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'tx_type', type: 'enum', enum: FeeType })
  txType!: FeeType;

  @Column({ name: 'tx_id' })
  txId!: string;

  @Column({
    name: 'gross_amount',
    type: 'numeric',
    precision: 24,
    scale: 8,
  })
  grossAmount!: string;

  @Column({
    name: 'fee_amount',
    type: 'numeric',
    precision: 24,
    scale: 8,
  })
  feeAmount!: string;

  @Column({
    name: 'net_amount',
    type: 'numeric',
    precision: 24,
    scale: 8,
  })
  netAmount!: string;

  @Column({ name: 'fee_config_id' })
  feeConfigId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
