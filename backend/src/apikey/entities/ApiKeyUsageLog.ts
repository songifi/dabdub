import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity()
export class ApiKeyUsageLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  keyId: string;

  @Column()
  endpoint: string;

  @Column()
  ipAddress: string;

  @Column()
  responseStatus: number;

  @CreateDateColumn()
  createdAt: Date;
}
