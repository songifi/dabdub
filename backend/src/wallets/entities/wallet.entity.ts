import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('wallets')
export class Wallet extends BaseEntity {
  @Column({ name: 'user_id', unique: true })
  @Index()
  userId!: string;

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

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true, default: null })
  lastSyncedAt!: Date | null;
}
