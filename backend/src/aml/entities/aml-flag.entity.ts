import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AmlFlagReason {
  HIGH_VALUE = 'high_value',
  HIGH_VELOCITY = 'high_velocity',
}

export enum AmlFlagStatus {
  PENDING = 'pending',
  CLEARED = 'cleared',
  ESCALATED = 'escalated',
}

@Entity('aml_flags')
export class AmlFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  merchantId: string;

  @Column({ nullable: true })
  paymentId: string;

  @Column({ type: 'enum', enum: AmlFlagReason })
  reason: AmlFlagReason;

  @Column({ type: 'enum', enum: AmlFlagStatus, default: AmlFlagStatus.PENDING })
  status: AmlFlagStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  reviewedBy: string;

  @Column({ nullable: true })
  reviewedAt: Date;

  @Column({ nullable: true })
  reviewNote: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
