import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("email_delivery_logs")
export class EmailDeliveryLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  recipient: string;

  @Column()
  subject: string;

  @Column({ default: 1 })
  attemptNumber: number;

  @Column({ default: "failure" })
  status: "success" | "failure";

  @Column({ type: "text", nullable: true })
  error: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
