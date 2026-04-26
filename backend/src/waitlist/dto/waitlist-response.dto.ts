import { ApiProperty } from '@nestjs/swagger';

export class UsernameAvailabilityDto {
  @ApiProperty({ example: true })
  available!: boolean;
}

export class WaitlistStatsDto {
  @ApiProperty({ example: 12840 })
  total!: number;
}
