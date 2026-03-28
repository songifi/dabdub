import { ApiProperty } from '@nestjs/swagger';
import { PayLink } from '../entities/pay-link.entity';

export class ListPayLinksResponseDto {
  @ApiProperty({ type: [PayLink] })
  items!: PayLink[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 7 })
  total!: number;
}
