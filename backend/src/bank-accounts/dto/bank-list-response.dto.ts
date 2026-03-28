import { ApiProperty } from '@nestjs/swagger';
import { BankListItemDto } from './bank-list-item.dto';

export class BankListResponseDto {
  @ApiProperty({ type: [BankListItemDto] })
  banks!: BankListItemDto[];
}
