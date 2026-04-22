import { ApiProperty } from '@nestjs/swagger';

export class RateQuoteResponseDto {
  @ApiProperty({ example: '1550.25', description: 'Quote amount (USDC per NGN or as configured)' })
  rate!: string;

  @ApiProperty({ format: 'date-time' })
  fetchedAt!: Date;

  @ApiProperty({ example: 'flutterwave' })
  source!: string;

  @ApiProperty({ description: 'True when cached value is older than freshness window' })
  isStale!: boolean;
}
