import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum OtpType {
  EMAIL_VERIFY = 'email_verify',
  PHONE_VERIFY = 'phone_verify',
  LOGIN = 'login',
  WITHDRAW = 'withdraw',
  KYC = 'kyc',
}

@Entity('otps')
export class Otp extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'code_hash', length: 255 })
  codeHash!: string;

  @Column({
    type: 'enum',
    enum: OtpType,
    enumName: 'otp_type_enum',
  })
  type!: OtpType;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({
    name: 'used_at',
    type: 'timestamptz',
    nullable: true,
    default: null,
  })
  usedAt!: Date | null;

  @Column({ name: 'ip_address', length: 64 })
  ipAddress!: string;
}
