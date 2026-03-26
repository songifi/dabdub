import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum VirtualAccountProvider {
  FLUTTERWAVE = 'flutterwave',
  PAYSTACK = 'paystack',
}

@Entity('virtual_accounts')
export class VirtualAccount extends BaseEntity {
  @Index({ unique: true })
  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'account_number', length: 20 })
  accountNumber!: string;

  @Column({ name: 'bank_name', length: 100 })
  bankName!: string;

  @Column({ length: 100 })
  reference!: string;

  @Column({ type: 'enum', enum: VirtualAccountProvider, default: VirtualAccountProvider.FLUTTERWAVE })
  provider!: VirtualAccountProvider;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true, default: null })
  expiresAt!: Date | null;
}
