import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';

@Entity('blockchain_wallets')
export class BlockchainWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  userId: string;

  @Column({ type: 'varchar', unique: true })
  stellarAddress: string;

  /** AES-256-GCM ciphertext of the Stellar secret key */
  @Column({ type: 'text' })
  encryptedSecretKey: string;

  /** AES-256-GCM initialization vector (hex) */
  @Column({ type: 'varchar' })
  iv: string;

  /** USDC balance stored as string to avoid float precision loss */
  @Column({ type: 'varchar', default: '0' })
  balanceUsdc: string;

  @Column({ type: 'varchar', default: '0' })
  stakedBalance: string;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @OneToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;
}
