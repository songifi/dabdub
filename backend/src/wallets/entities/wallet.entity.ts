import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity('wallets')
export class Wallet extends BaseEntity {
  @Column({ name: 'user_id', unique: true })
  @Index()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'stellar_address', unique: true, length: 56 })
  stellarAddress!: string;

  @Column({ name: 'encrypted_secret_key', type: 'text' })
  encryptedSecretKey!: string;

  @Column({ name: 'iv', type: 'text' })
  iv!: string;

  @Column({ name: 'balance', type: 'varchar', default: '0' })
  balance!: string;

  @Column({ name: 'staked_balance', type: 'varchar', default: '0' })
  stakedBalance!: string;

  /** USDC amount reserved while a transaction dispute is open (off-chain ledger). */
  @Column({ name: 'disputed_hold', type: 'varchar', default: '0' })
  disputedHold!: string;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true, default: null })
  lastSyncedAt!: Date | null;
}
