import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum FeedbackType {
  TRANSACTION_RATING = 'transaction_rating',
  FEATURE_FEEDBACK = 'feature_feedback',
  NPS = 'nps',
}

@Entity('feedback')
export class Feedback extends BaseEntity {
  @Column({ name: 'user_id' })
  userId!: string;

  @Column({
    type: 'enum',
    enum: FeedbackType,
  })
  type!: FeedbackType;

  @Column({ type: 'int', nullable: true })
  rating!: number | null;

  @Column({ name: 'nps_score', type: 'int', nullable: true })
  npsScore!: number | null;

  @Column({ type: 'text', nullable: true })
  message!: string | null;

  @Column({ type: 'jsonb', default: {} })
  context!: Record<string, unknown>;

  @Column({ name: 'app_version', type: 'varchar', length: 64, nullable: true })
  appVersion!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  platform!: string | null;

  @Column({ name: 'requires_outreach', default: false })
  requiresOutreach!: boolean;
}