import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { encryptedColumnTransformer } from '../../security/encrypted-column.transformer';

@Entity('blockchain_wallets')
export class BlockchainWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  userId: string;

  @Column({ type: 'varchar', unique: true })
  stellarAddress: string;

  /** AES-256-GCM ciphertext of the Stellar secret key */
  @Exclude()
  @Column({
    type: 'text',
    transformer: encryptedColumnTransformer(
      'blockchain_wallets.encryptedSecretKey',
    ),
  })
  encryptedSecretKey: string;

  /** AES-256-GCM initialization vector (hex) */
  @Column({ type: 'varchar', nullable: true })
  iv: string | null;

  /** USDC balance stored as string to avoid float precision loss */
  @Column({ type: 'varchar', default: '0' })
  balanceUsdc: string;

  @Column({ type: 'varchar', default: '0' })
  stakedBalance: string;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
