import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class BulkPaymentUploadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label: string;

  @IsString()
  @IsNotEmpty()
  pin: string;
}