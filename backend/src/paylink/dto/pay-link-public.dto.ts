import { ApiProperty } from '@nestjs/swagger';
import { PayLinkStatus } from '../entities/pay-link.entity';

export class PayLinkPublicDto {
  @ApiProperty({ nullable: true, example: 'Jane Doe' })
  creatorDisplayName!: string | null;

  @ApiProperty({ nullable: true, example: 'Yaba Electronics' })
  businessName!: string | null;

  @ApiProperty({ example: '25.50' })
  amount!: string;

  @ApiProperty({ nullable: true, example: 'Invoice #1003' })
  note!: string | null;

  @ApiProperty({ enum: PayLinkStatus, example: PayLinkStatus.ACTIVE })
  status!: PayLinkStatus;

  @ApiProperty({ example: '2026-03-29T12:00:00.000Z' })
  expiresAt!: Date;
}
