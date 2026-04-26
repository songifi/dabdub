import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { GroupMember } from './group-member.entity';

@Entity('groups')
@Index('IDX_GROUP_INVITE_CODE', ['inviteCode'], { unique: true, where: '"inviteCode" IS NOT NULL' })
@Index('IDX_GROUP_NAME', ['name'])
export class Group {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', nullable: true })
  avatarUrl?: string;

  @Column({ type: 'uuid' })
  createdBy: string;

  @Column({ type: 'int', default: 100 })
  maxMembers: number;

  @Column({ type: 'boolean', default: true })
  isPublic: boolean;

  @Column({ type: 'varchar', length: 16, nullable: true, unique: true })
  inviteCode?: string;

  @Column({ type: 'boolean', default: false })
  isTokenGated: boolean;

  @Column({ type: 'varchar', nullable: true })
  gateTokenAddress?: string;

  @Column({ type: 'decimal', precision: 36, scale: 7, nullable: true })
  gateMinBalance?: number;

  /** Stellar on-chain group contract address / ID */
  @Column({ type: 'varchar', nullable: true })
  onChainId?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date;

  @OneToMany(() => GroupMember, (m) => m.group, { cascade: true })
  members: GroupMember[];
}
