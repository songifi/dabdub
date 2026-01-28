import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

export enum EVMTransactionStatus {
    PENDING = 'pending',
    CONFIRMED = 'confirmed',
    FAILED = 'failed',
    DROPPED = 'dropped',
    REPLACED = 'replaced',
}

@Entity('evm_transactions')
export class EVMTransactionEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ unique: true })
    txHash!: string;

    @Column()
    fromAddress!: string;

    @Column()
    toAddress!: string;

    @Column()
    amount!: string; // Stored as wei/smallest unit string

    @Column()
    currency!: string; // 'USDC', 'ETH', 'MATIC', etc.

    @Column()
    chain!: string;

    @Column({ nullable: true })
    nonce!: number;

    @Column({ nullable: true })
    gasPrice!: string;

    @Column({ nullable: true })
    gasUsed!: string;

    @Column({
        type: 'enum',
        enum: EVMTransactionStatus,
        default: EVMTransactionStatus.PENDING,
    })
    status!: EVMTransactionStatus;

    @Column({ nullable: true })
    blockNumber!: number;

    @Column({ default: 0 })
    confirmations!: number;

    @Column({ nullable: true, type: 'text' })
    error!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
