import { ApiProperty } from '@nestjs/swagger';
import { VirtualAccountProvider } from '../entities/virtual-account.entity';

export class VirtualAccountResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ example: '0123456789' })
  accountNumber!: string;

  @ApiProperty({ example: 'Test Bank' })
  bankName!: string;

  @ApiProperty()
  reference!: string;

  @ApiProperty({ enum: VirtualAccountProvider })
  provider!: VirtualAccountProvider;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  expiresAt!: Date | null;
}
