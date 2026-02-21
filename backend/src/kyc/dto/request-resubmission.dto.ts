import {
  ArrayMinSize,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RequestResubmissionDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  resubmissionFields: string[];

  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  message: string;
}
