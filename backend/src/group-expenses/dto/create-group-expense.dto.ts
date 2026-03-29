import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { GroupExpenseSplitType } from '../entities/group-expense.entity';

export class GroupExpenseParticipantDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,6})?$/)
  amountOwed?: string;

  @IsOptional()
  percentage?: number;
}

export class CreateGroupExpenseDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @Matches(/^\d+(\.\d{1,6})?$/)
  totalAmount!: string;

  @IsString()
  tokenId!: string;

  @IsEnum(GroupExpenseSplitType)
  splitType!: GroupExpenseSplitType;

  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupExpenseParticipantDto)
  splits?: GroupExpenseParticipantDto[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  participantIds?: string[];
}
