import { VirtualAccountProvider } from '../entities/virtual-account.entity';

export class VirtualAccountResponseDto {
  id!: string;
  userId!: string;
  accountNumber!: string;
  bankName!: string;
  reference!: string;
  provider!: VirtualAccountProvider;
  expiresAt!: Date | null;
}
