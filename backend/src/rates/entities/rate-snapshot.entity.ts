import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('rate_snapshots')
export class RateSnapshot extends BaseEntity {
  @Column({ type: 'varchar', length: 10 })
  base!: string;

  @Column({ type: 'varchar', length: 10 })
  quote!: string;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  rate!: string;

  @Column({ type: 'varchar', length: 50 })
  source!: string;

  @Column({ name: 'fetched_at', type: 'timestamptz' })
  fetchedAt!: Date;
}
