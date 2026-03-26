import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum YieldSource {
  STAKING_REWARD = 'staking_reward',
  BONUS = 'bonus',
  REFERRAL = 'referral',
}

@Entity('yield_entries')
export class YieldEntry extends BaseEntity {
  @Column({ name: 'user_id' })
  userId!: string;

  @Column({
    name: 'amount_usdc',
    type: 'numeric',
    precision: 24,
    scale: 8,
  })
  amountUsdc!: string;

  @Column({ type: 'enum', enum: YieldSource, default: YieldSource.STAKING_REWARD })
  source!: YieldSource;

  @Column({ length: 255, nullable: true })
  note!: string | null;
}
