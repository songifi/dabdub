import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
} from 'typeorm';
import { UserEntity } from './user.entity';

export enum WalletType {
    DEPOSIT = 'deposit',
    TREASURY = 'treasury',
}

@Entity('wallets')
export class WalletEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column()
    address!: string;

    @Column()
    privateKey!: string; // Encryption should be handled by an encryption service before saving

    @Column()
    chain!: string;

    @Column({
        type: 'enum',
        enum: WalletType,
        default: WalletType.DEPOSIT,
    })
    type!: WalletType;

    @ManyToOne(() => UserEntity, { nullable: true })
    user!: UserEntity;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
