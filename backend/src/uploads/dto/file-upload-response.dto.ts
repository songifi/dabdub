import { ApiProperty } from '@nestjs/swagger';
import { UploadPurpose } from '../entities/file-upload.entity';

export class FileUploadResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  key!: string;

  @ApiProperty()
  bucket!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  sizeBytes!: number;

  @ApiProperty({ enum: UploadPurpose })
  purpose!: UploadPurpose;

  @ApiProperty()
  isConfirmed!: boolean;
}
