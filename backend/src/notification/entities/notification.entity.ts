import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

export enum NotificationType {
    EMAIL = 'email',
    SMS = 'sms',
    PUSH = 'push',
}

export enum NotificationStatus {
    PENDING = 'pending',
    SENT = 'sent',
    FAILED = 'failed',
    QUEUED = 'queued',
}

@Entity('notifications')
@Index(['userId', 'createdAt'])
export class Notification {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ nullable: true })
    userId!: string;

    @Column({
        type: 'enum',
        enum: NotificationType,
    })
    type!: NotificationType;

    @Column({
        type: 'enum',
        enum: NotificationStatus,
        default: NotificationStatus.PENDING,
    })
    status!: NotificationStatus;

    @Column('text')
    recipient!: string;

    @Column({ nullable: true })
    subject!: string;

    @Column('text')
    content!: string;

    @Column({ type: 'jsonb', nullable: true })
    metadata!: Record<string, any>;

    @Column({ nullable: true })
    error!: string;

    @Column({ type: 'timestamp', nullable: true })
    sentAt!: Date;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
