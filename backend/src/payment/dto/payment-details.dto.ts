import { PaymentStatus } from '../../database/entities/payment.entity';

export class PaymentDetailsDto {
  id!: string;
  amount!: number;
  currency!: string;
  status!: PaymentStatus;
  network?: string;
  description?: string;
  reference?: string;
  createdAt!: Date;
  updatedAt!: Date;
}
