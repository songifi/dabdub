import { ApiProperty } from '@nestjs/swagger';

export class BankListItemDto {
  @ApiProperty({ example: '044' })
  code!: string;

  @ApiProperty({ example: 'Access Bank' })
  name!: string;
}
