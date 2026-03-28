import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('bank_accounts')
@Index(['userId', 'isVerified'])
export class BankAccount extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'bank_code', length: 20 })
  bankCode!: string;

  @Column({ name: 'bank_name', length: 120 })
  bankName!: string;

  @Column({ name: 'account_number', length: 10 })
  accountNumber!: string;

  @Column({ name: 'account_name', length: 160 })
  accountName!: string;

  @Column({ name: 'is_default', default: false })
  isDefault!: boolean;

  @Column({ name: 'is_verified', default: true })
  isVerified!: boolean;
}
