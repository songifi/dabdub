import {
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreateTagDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateTagDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color?: string;

  @IsOptional()
  @IsString()
  description?: string | null;
}

export class MerchantTagResponseDto {
  id: string;
  name: string;
  color: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class AssignTagDto {
  @IsUUID('4')
  tagId: string;
}

export class MerchantTagAssignmentResponseDto {
  id: string;
  merchantId: string;
  tagId: string;
  tag: MerchantTagResponseDto;
  assignedById: string;
  createdAt: Date;
}
