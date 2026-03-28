import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class SandboxSimulateDepositDto {
  @ApiProperty({ example: 125.5 })
  @IsNumber()
  @Min(0.000001)
  amountUsdc!: number;
}
