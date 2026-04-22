import { ApiProperty } from '@nestjs/swagger';

export class WsStatsResponseDto {
  @ApiProperty({ description: 'Distinct users with at least one active socket' })
  connectedUsers!: number;

  @ApiProperty({ description: 'Total socket connections' })
  totalSockets!: number;
}
