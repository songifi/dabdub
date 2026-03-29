import { IsEnum, IsOptional, IsPositive, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { GroupExpenseStatus } from '../entities/group-expense.entity';

export class QueryGroupExpensesDto {
  @IsOptional()
  @IsEnum(GroupExpenseStatus)
  status?: GroupExpenseStatus;

  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  limit?: number = 20;
}
