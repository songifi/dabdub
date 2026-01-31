import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class BatchSettlementDto {
  @ApiProperty({
    description: 'Array of settlement IDs to include in the batch',
    example: ['123e4567-e89b-12d3-a456-426614174000'],
  })
  @IsArray()
  @IsNotEmpty()
  @IsUUID('all', { each: true })
  settlementIds!: string[];
}
