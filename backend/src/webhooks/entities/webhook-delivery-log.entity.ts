import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("webhook_delivery_logs")
export class WebhookDeliveryLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  webhookId: string;

  @Column()
  event: string;

  @Column()
  requestUrl: string;

  @Column("text")
  requestBody: string;

  @Column({ default: 1 })
  attemptNumber: number;

  @Column({ default: "failure" })
  status: "success" | "failure";

  @Column({ nullable: true })
  responseCode: number;

  @Column({ type: "text", nullable: true })
  error: string;

  @Column({ default: 0 })
  retryDelayMs: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
