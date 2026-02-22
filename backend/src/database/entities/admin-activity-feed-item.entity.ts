import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { FeedItemType } from './admin-activity-feed.enums';

@Entity('admin_activity_feed_items')
@Index(['adminId', 'eventAt'])
@Index(['adminId', 'isRead'])
export class AdminActivityFeedItem extends BaseEntity {
    @Column({ type: 'uuid' })
    adminId: string;

    @Column({
        type: 'enum',
        enum: FeedItemType,
    })
    type: FeedItemType;

    @Column({ type: 'text' })
    title: string;

    @Column({ type: 'text', nullable: true })
    detail: string | null;

    @Column({ nullable: true })
    resourceType: string | null;

    @Column({ nullable: true })
    resourceId: string | null;

    @Column({ nullable: true })
    resourceUrl: string | null;

    @Column({ type: 'boolean', default: false })
    isRead: boolean;

    @Column({ type: 'timestamptz', nullable: true })
    readAt: Date | null;

    @Column({ type: 'timestamptz' })
    eventAt: Date;
}
