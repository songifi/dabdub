import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum CardBrand {
  VISA = 'visa',
  MASTERCARD = 'mastercard',
}

export enum CardStatus {
  ACTIVE = 'active',
  FROZEN = 'frozen',
  TERMINATED = 'terminated',
}

@Entity('virtual_cards')
export class VirtualCard extends BaseEntity {
  @Index({ unique: true })
  @Column({ name: 'user_id' })
  userId!: string;

  @Index({ unique: true })
  @Column({ name: 'sudo_card_id', length: 100 })
  sudoCardId!: string;

  @Column({ name: 'last4', length: 4 })
  last4!: string;

  @Column({
    type: 'enum',
    enum: CardBrand,
  })
  brand!: CardBrand;

  @Column({ name: 'currency', length: 10, default: 'USD' })
  currency!: string;

  @Column({
    type: 'enum',
    enum: CardStatus,
    default: CardStatus.ACTIVE,
  })
  status!: CardStatus;

  @Column({
    name: 'spending_limit',
    type: 'varchar',
    nullable: true,
    default: null,
  })
  spendingLimit!: string | null;

  @Column({
    name: 'balance',
    type: 'varchar',
  })
  balance!: string;

  @Column({
    name: 'billing_address',
    type: 'jsonb',
    nullable: true,
    default: null,
  })
  billingAddress?: Record<string, any> | null;

  @Column({
    name: 'terminated_at',
    type: 'timestamptz',
    nullable: true,
    default: null,
  })
  terminatedAt!: Date | null;
}
