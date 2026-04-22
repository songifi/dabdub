import { IsEnum, IsInt, IsPositive, IsString, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UploadPurpose } from '../entities/file-upload.entity';

export class PresignDto {
  @ApiProperty({ enum: UploadPurpose, example: UploadPurpose.KYC })
  @IsEnum(UploadPurpose)
  purpose!: UploadPurpose;

  @ApiProperty({ example: 'image/png' })
  @IsString()
  mimeType!: string;

  @ApiProperty({ example: 1_048_576, maximum: 10 * 1024 * 1024 })
  @IsInt()
  @IsPositive()
  @Max(10 * 1024 * 1024)
  sizeBytes!: number;
}
