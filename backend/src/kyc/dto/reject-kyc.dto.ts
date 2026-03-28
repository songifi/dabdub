import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class RejectKycDto {
  @ApiProperty({ description: 'Reason for rejection shown to user' })
  @IsString()
  @Length(1, 1000)
  reviewNote!: string;
}
