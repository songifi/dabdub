import { ApiProperty } from '@nestjs/swagger';

export class ReferralCodeResponseDto {
  @ApiProperty({
    example: 'CH-john-AB12',
  })
  code!: string;
}

export class ReferralStatsDto {
  @ApiProperty({ example: 3 })
  totalReferred!: number;

  @ApiProperty({ example: 1 })
  converted!: number;

  @ApiProperty({ example: 2 })
  pending!: number;

  @ApiProperty({ example: '5.00' })
  totalEarnedUsdc!: string;
}
