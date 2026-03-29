import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

export enum Frequency {
  WEEKLY = "weekly",
  MONTHLY = "monthly",
}

export enum Status {
  ACTIVE = "active",
  PAUSED = "paused",
  CANCELLED = "cancelled",
}

@Entity()
export class ScheduledPayout {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @Column()
  toUsername: string;

  @Column("varchar")
  amountUsdc: string;

  @Column("varchar", { nullable: true })
  note: string | null;

  @Column({ type: "enum", enum: Frequency })
  frequency: Frequency;

  @Column({ type: "int", nullable: true })
  dayOfWeek: number | null; // 0–6

  @Column({ type: "int", nullable: true })
  dayOfMonth: number | null; // 1–28

  @Column({ type: "timestamp" })
  nextRunAt: Date;

  @Column({ type: "timestamp", nullable: true })
  lastRunAt: Date | null;

  @Column({ type: "enum", enum: Status, default: Status.ACTIVE })
  status: Status;

  @Column({ type: "int", default: 0 })
  totalRuns: number;

  @Column({ type: "int", default: 0 })
  failureCount: number;

  @CreateDateColumn()
  createdAt: Date;
}
