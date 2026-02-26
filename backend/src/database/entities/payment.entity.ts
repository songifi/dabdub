import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('decimal', { precision: 18, scale: 8 })
  amount!: number;

  @Column()
  currency!: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status!: PaymentStatus;

  @Column({ nullable: true })
  network!: string;

  @Column({ type: 'uuid', nullable: true })
  merchantId?: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  reference?: string;

  @Column({ name: 'depositAddress', nullable: true })
  depositAddress?: string;

  @Column({
    name: 'usdcAmount',
    type: 'decimal',
    precision: 18,
    scale: 8,
    nullable: true,
  })
  usdcAmount?: number;

  @Column({ name: 'expiresAt', type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @Column({ name: 'idempotencyKey', nullable: true })
  idempotencyKey?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
