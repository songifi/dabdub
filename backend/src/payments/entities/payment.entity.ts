import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Merchant } from "../../merchants/entities/merchant.entity";
import { Settlement } from "../../settlements/entities/settlement.entity";

export enum PaymentStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  SETTLING = "settling",
  SETTLED = "settled",
  FAILED = "failed",
  EXPIRED = "expired",
}

export enum PaymentNetwork {
  STELLAR = "stellar",
}

@Entity("payments")
export class Payment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  reference: string;

  @ManyToOne(() => Merchant, (merchant) => merchant.payments)
  @JoinColumn({ name: "merchantId" })
  merchant: Merchant;

  @Column()
  merchantId: string;

  @Column({ type: "decimal", precision: 18, scale: 6 })
  amountUsd: number;

  @Column({ type: "decimal", precision: 18, scale: 7, nullable: true })
  amountXlm: number;

  @Column({ type: "decimal", precision: 18, scale: 6, nullable: true })
  amountUsdc: number;

  @Column({ nullable: true })
  currency: string;

  @Column({
    type: "enum",
    enum: PaymentNetwork,
    default: PaymentNetwork.STELLAR,
  })
  network: PaymentNetwork;

  @Column({ type: "enum", enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ nullable: true })
  stellarDepositAddress: string;

  @Column({ nullable: true })
  stellarMemo: string;

  @Column({ nullable: true })
  txHash: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  customerEmail: string;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  qrCode: string;

  @Column({ type: "decimal", precision: 18, scale: 6, nullable: true })
  feeUsd: number;

  @Column({ type: "decimal", precision: 18, scale: 6, nullable: true })
  settlementAmountFiat: number;

  @Column({ nullable: true })
  settlementCurrency: string;

  @Column({ nullable: true })
  expiresAt: Date;

  @Column({ nullable: true })
  confirmedAt: Date;

  @ManyToOne(() => Settlement, { nullable: true })
  @JoinColumn({ name: "settlementId" })
  settlement: Settlement;

  @Column({ nullable: true })
  settlementId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
