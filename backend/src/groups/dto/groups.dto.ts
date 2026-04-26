import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(10000)
  maxMembers?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdateGroupDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(10000)
  maxMembers?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class SetTokenGateDto {
  @ApiProperty({ description: 'Stellar asset code or contract address' })
  @IsString()
  gateTokenAddress: string;

  @ApiProperty({ description: 'Minimum token balance required to join' })
  @IsNumber()
  @Min(0)
  gateMinBalance: number;
}

export class SearchGroupsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class GroupResponseDto {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  createdBy: string;
  maxMembers: number;
  isPublic: boolean;
  inviteCode?: string;
  isTokenGated: boolean;
  gateTokenAddress?: string;
  gateMinBalance?: number;
  onChainId?: string;
  memberCount: number;
  createdAt: Date;

  static from(group: import('../entities/group.entity').Group): GroupResponseDto {
    const dto = new GroupResponseDto();
    dto.id = group.id;
    dto.name = group.name;
    dto.description = group.description;
    dto.avatarUrl = group.avatarUrl;
    dto.createdBy = group.createdBy;
    dto.maxMembers = group.maxMembers;
    dto.isPublic = group.isPublic;
    dto.inviteCode = group.inviteCode;
    dto.isTokenGated = group.isTokenGated;
    dto.gateTokenAddress = group.gateTokenAddress;
    dto.gateMinBalance = group.gateMinBalance;
    dto.onChainId = group.onChainId;
    dto.memberCount = group.members?.length ?? 0;
    dto.createdAt = group.createdAt;
    return dto;
  }
}
