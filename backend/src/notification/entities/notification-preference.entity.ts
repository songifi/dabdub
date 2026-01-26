import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

@Entity('notification_preferences')
@Index(['userId'], { unique: true })
export class NotificationPreference {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column()
    userId!: string;

    @Column({ default: true })
    emailEnabled!: boolean;

    @Column({ default: true })
    smsEnabled!: boolean;

    @Column({ default: true })
    pushEnabled!: boolean;

    @Column({ type: 'simple-array', default: [] })
    disabledTypes!: string[]; // e.g., 'marketing', 'system_alert'

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
