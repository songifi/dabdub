import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class SandboxSimulatePaymentDto {
  @ApiProperty({ example: 'TOKEN123ABC' })
  @IsString()
  @MaxLength(64)
  tokenId!: string;
}
