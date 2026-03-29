import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

export enum ApiPermission {
  PAYLINKS_CREATE = "paylinks.create",
  PAYLINKS_READ = "paylinks.read",
  PAYMENTS_READ = "payments.read",
  WEBHOOKS_MANAGE = "webhooks.manage",
}

@Entity()
export class ApiKey {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  merchantId: string;

  @Column({ length: 50 })
  name: string;

  @Column({ length: 8 })
  keyPrefix: string;

  @Column()
  keyHash: string;

  @Column("text", { array: true })
  permissions: ApiPermission[];

  @Column({ type: "timestamp", nullable: true })
  lastUsedAt: Date | null;

  @Column({ type: "timestamp", nullable: true })
  expiresAt: Date | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
