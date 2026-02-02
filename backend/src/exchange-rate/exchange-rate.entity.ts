import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('exchange_rates')
export class ExchangeRate {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    pair: string;

    @Column('decimal', { precision: 18, scale: 8 })
    rate: number;

    @Column('jsonb', { nullable: true })
    metadata: any; // Store individual provider rates, confidence score, etc.

    @CreateDateColumn()
    timestamp: Date;
}
