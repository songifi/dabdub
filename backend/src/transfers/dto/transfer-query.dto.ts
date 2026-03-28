import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString } from 'class-validator';

export enum TransferDirection {
  SENT = 'sent',
  RECEIVED = 'received',
}

export class TransferQueryDto {
  @ApiProperty({ enum: TransferDirection, required: false })
  @IsOptional()
  @IsEnum(TransferDirection)
  direction?: TransferDirection;

  @ApiProperty({ required: false, description: 'Cursor (last transfer id)' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  limit?: number;
}
