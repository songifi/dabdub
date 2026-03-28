import { IsString, MinLength } from 'class-validator';

export class ClearComplianceEventDto {
  @IsString()
  @MinLength(3)
  note!: string;
}
