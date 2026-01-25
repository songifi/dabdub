import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';

export enum WebhookEvent {
  PAYMENT_REQUEST_CREATED = 'payment_request.created',
  PAYMENT_REQUEST_UPDATED = 'payment_request.updated',
  PAYMENT_REQUEST_COMPLETED = 'payment_request.completed',
  PAYMENT_REQUEST_FAILED = 'payment_request.failed',
  SETTLEMENT_COMPLETED = 'settlement.completed',
  SETTLEMENT_FAILED = 'settlement.failed',
}

@Entity('webhook_configurations')
@Index(['isActive'])
@Index(['createdAt'])
export class WebhookConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 500 })
  url!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  secret?: string;

  @Column({
    type: 'simple-array',
    enum: WebhookEvent,
  })
  events!: WebhookEvent[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'retry_attempts', type: 'int', default: 3 })
  retryAttempts!: number;

  @Column({ name: 'retry_delay_ms', type: 'int', default: 1000 })
  retryDelayMs!: number;

  @Column({ name: 'timeout_ms', type: 'int', default: 30000 })
  timeoutMs!: number;

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

  @OneToMany('WebhookDeliveryLog', 'webhookConfiguration')
  deliveryLogs!: any[];
}
