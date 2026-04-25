import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Merchant } from '../../merchants/entities/merchant.entity';

export enum NotificationChannel {
  EMAIL = 'email',
  PUSH = 'push',
  IN_APP = 'in_app',
}

export enum NotificationEventType {
  PAYMENT_CONFIRMED = 'payment.confirmed',
  PAYMENT_SETTLED = 'payment.settled',
  SETTLEMENT_FAILED = 'settlement.failed',
}

@Entity('notification_preferences')
@Unique(['merchantId', 'channel', 'eventType'])
@Index(['merchantId'])
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'merchant_id' })
  merchantId: string;

  @ManyToOne(() => Merchant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;

  @Column({ type: 'enum', enum: NotificationEventType })
  eventType: NotificationEventType;

  /**
   * Whether this channel+event combination is enabled.
   * in_app channel is always forced to true at the service layer.
   */
  @Column({ default: true })
  enabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
