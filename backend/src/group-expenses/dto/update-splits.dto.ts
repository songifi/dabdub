import { IsArray, IsNotEmptyObject, IsOptional, IsString, IsUUID, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateExpenseSplitDto {
  @IsUUID()
  userId!: string;

  @Matches(/^\d+(\.\d{1,6})?$/)
  @IsOptional()
  amountOwed?: string;

  @IsOptional()
  percentage?: number;
}

export class UpdateSplitsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateExpenseSplitDto)
  splits!: UpdateExpenseSplitDto[];
}
