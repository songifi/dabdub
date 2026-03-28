import { IsString } from 'class-validator';

export class ConfirmUploadDto {
  @IsString()
  key!: string;
}
