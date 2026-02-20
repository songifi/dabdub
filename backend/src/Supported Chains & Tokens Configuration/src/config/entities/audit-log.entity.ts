import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity("audit_logs")
@Index(["entityType", "entityId"])
@Index(["action", "createdAt"])
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  action: string; // CHAIN_CONFIG_UPDATED, TOKEN_ADDED, etc.

  @Column()
  entityType: string; // 'blockchain_config' or 'token_config'

  @Column()
  entityId: string;

  @Column({ type: "text" })
  description: string;

  @Column({ type: "jsonb" })
  changes: Record<string, any>; // Full diff of changes

  @Column({ nullable: true })
  userId: string;

  @Column({ type: "inet", nullable: true })
  ipAddress: string;

  @CreateDateColumn()
  createdAt: Date;
}
