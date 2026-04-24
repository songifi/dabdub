import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Announcement } from './announcement.entity';
import { User } from '../../users/entities/user.entity';

@Entity('announcement_dismissals')
@Unique('UQ_announcement_dismissals_user_announcement', [
  'userId',
  'announcementId',
])
@Index(['userId', 'announcementId'])
export class AnnouncementDismissal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'announcement_id', type: 'uuid' })
  announcementId!: string;

  @CreateDateColumn({ name: 'dismissed_at', type: 'timestamptz' })
  dismissedAt!: Date;

  @ManyToOne(() => Announcement, (announcement) => announcement.dismissals, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'announcement_id' })
  announcement!: Announcement;
}
