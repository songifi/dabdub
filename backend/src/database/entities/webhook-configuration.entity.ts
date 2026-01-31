import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { WebhookDeliveryLogEntity } from './webhook-delivery-log.entity';
import { Merchant } from './merchant.entity';

export enum WebhookEvent {
  PAYMENT_REQUEST_CREATED = 'payment_request.created',
  PAYMENT_REQUEST_UPDATED = 'payment_request.updated',
  PAYMENT_REQUEST_COMPLETED = 'payment_request.completed',
  PAYMENT_REQUEST_FAILED = 'payment_request.failed',
  SETTLEMENT_COMPLETED = 'settlement.completed',
  SETTLEMENT_FAILED = 'settlement.failed',
}

export enum WebhookStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  FAILED = 'failed',
}

@Entity('webhook_configurations')
@Index(['status'])
@Index(['createdAt'])
export class WebhookConfigurationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'verification_method', type: 'varchar', nullable: true })
  verificationMethod?: string;

  @Index()
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId!: string;

  @ManyToOne(() => Merchant, (merchant) => merchant.webhookConfigurations)
  @JoinColumn({ name: 'merchant_id' })
  merchant!: Merchant;

  @Column({ type: 'varchar', length: 500 })
  url!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  secret?: string;

  @Column({
    type: 'simple-array',
    enum: WebhookEvent,
  })
  events!: WebhookEvent[];

  @Column({
    type: 'enum',
    enum: WebhookStatus,
    default: WebhookStatus.ACTIVE,
  })
  status!: WebhookStatus;

  @Column({ name: 'headers', type: 'jsonb', nullable: true })
  headers?: Record<string, string>;

  @Column({ name: 'consecutive_failures', type: 'int', default: 0 })
  consecutiveFailures!: number;

  @Column({ name: 'max_consecutive_failures', type: 'int', default: 5 })
  maxConsecutiveFailures!: number;

  @Column({ name: 'last_delivered_at', type: 'timestamp', nullable: true })
  lastDeliveredAt?: Date;

  @Column({ name: 'last_failure_at', type: 'timestamp', nullable: true })
  lastFailureAt?: Date;

  @Column({ name: 'disabled_at', type: 'timestamp', nullable: true })
  disabledAt?: Date;

  @Column({
    name: 'disabled_reason',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  disabledReason?: string;

  @Column({ name: 'max_retries', type: 'int', default: 3 })
  maxRetries!: number;

  @Column({ name: 'batch_enabled', type: 'boolean', default: false })
  batchEnabled!: boolean;

  @Column({ name: 'batch_max_size', type: 'int', default: 20 })
  batchMaxSize!: number;

  @Column({ name: 'batch_window_ms', type: 'int', default: 2000 })
  batchWindowMs!: number;

  @Column({ name: 'retry_delay', type: 'int', default: 1000 })
  retryDelay!: number;

  @Column({ name: 'timeout', type: 'int', default: 5000 })
  timeout!: number;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;

  @OneToMany(() => WebhookDeliveryLogEntity, (log) => log.webhookConfiguration)
  deliveryLogs!: WebhookDeliveryLogEntity[];
}
