import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('rate_snapshots')
export class RateSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  pair: string;

  @Column('float')
  rate: number;

  @CreateDateColumn()
  createdAt: Date;
}
