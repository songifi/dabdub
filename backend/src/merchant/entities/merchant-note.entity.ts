import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Merchant } from '../../database/entities/merchant.entity';
import { UserEntity } from '../../database/entities/user.entity';

export enum NoteCategory {
  GENERAL = 'GENERAL',
  COMPLIANCE = 'COMPLIANCE',
  RISK = 'RISK',
  COMMERCIAL = 'COMMERCIAL',
  TECHNICAL = 'TECHNICAL',
  FOLLOW_UP = 'FOLLOW_UP',
}

@Entity('merchant_notes')
@Index(['merchantId'])
@Index(['createdAt'])
@Index(['authorId'])
@Index(['merchantId', 'isPinned'])
export class MerchantNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'merchant_id' })
  merchantId: string;

  @ManyToOne(() => Merchant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @Column({ name: 'author_id' })
  authorId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'author_id' })
  author: UserEntity;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'boolean', default: false })
  isPinned: boolean;

  @Column({ type: 'enum', enum: NoteCategory, default: NoteCategory.GENERAL })
  category: NoteCategory;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  mentionedAdminIds: string[];

  @Column({ type: 'boolean', default: false })
  isEdited: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  editedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  followUpAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
