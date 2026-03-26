import { IsEnum, IsInt, IsPositive, IsString, Max } from 'class-validator';
import { UploadPurpose } from '../entities/file-upload.entity';

export class PresignDto {
  @IsEnum(UploadPurpose)
  purpose!: UploadPurpose;

  @IsString()
  mimeType!: string;

  @IsInt()
  @IsPositive()
  @Max(10 * 1024 * 1024)
  sizeBytes!: number;
}
