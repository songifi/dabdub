import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SplitParticipantDto {
  @ApiProperty({ example: 'alice' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: '5.00' })
  @IsNumberString()
  amountUsdc!: string;
}

export class CreateSplitDto {
  @ApiProperty({ example: 'Dinner at Nkoyo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;

  @ApiProperty({ example: 24 })
  @IsInt()
  @Min(1)
  expiresInHours!: number;

  @ApiProperty({ type: [SplitParticipantDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SplitParticipantDto)
  participants!: SplitParticipantDto[];
}
