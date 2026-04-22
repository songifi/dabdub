import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum FraudSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum FraudStatus {
  OPEN = 'open',
  REVIEWING = 'reviewing',
  RESOLVED = 'resolved',
  FALSE_POSITIVE = 'false_positive',
}

@Entity('fraud_flags')
export class FraudFlag extends BaseEntity {
  @Column()
  userId!: string;

  @Column()
  rule!: string;

  @Column({ type: 'enum', enum: FraudSeverity })
  severity!: FraudSeverity;

  @Column({ type: 'text' })
  description!: string;

  @Column()
  triggeredBy!: string; // txId

  @Column({ type: 'enum', enum: FraudStatus, default: FraudStatus.OPEN })
  status!: FraudStatus;

  @Column({ nullable: true, type: 'varchar' })
  resolvedBy!: string | null; // adminId

  @Column({ nullable: true, type: 'timestamptz' })
  resolvedAt!: Date | null;

  @Column({ nullable: true, type: 'text' })
  resolutionNote!: string | null;
}
