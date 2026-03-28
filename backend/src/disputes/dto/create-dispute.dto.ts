import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { DisputeType } from '../entities/dispute.entity';

export class CreateDisputeDto {
  @ApiProperty()
  @IsUUID()
  transactionId!: string;

  @ApiProperty({ enum: DisputeType })
  @IsEnum(DisputeType)
  type!: DisputeType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;
}
