import { IsString, IsNotEmpty, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class BillingAddressDto {
  @IsString()
  @IsNotEmpty()
  street!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;

  @IsString()
  @IsNotEmpty()
  country!: string;

  @IsString()
  @IsNotEmpty()
  postalCode!: string;
}

export class CreateVirtualCardDto {
  @IsString()
  @IsNotEmpty()
  billingName!: string;

  @ValidateNested()
  @Type(() => BillingAddressDto)
  @IsNotEmpty()
  billingAddress!: BillingAddressDto;
}

export class FundVirtualCardDto {
  @IsString()
  @IsNotEmpty()
  amountUsd!: string;
}

export class VirtualCardResponseDto {
  id!: string;
  userId!: string;
  sudoCardId!: string;
  last4!: string;
  brand!: string;
  currency!: string;
  status!: string;
  spendingLimit!: string | null;
  balance!: string;
  billingAddress?: Record<string, any> | null;
  createdAt!: Date;
  terminatedAt?: Date | null;

  static fromEntity(entity: any): VirtualCardResponseDto {
    const dto = new VirtualCardResponseDto();
    dto.id = entity.id;
    dto.userId = entity.userId;
    dto.sudoCardId = entity.sudoCardId;
    dto.last4 = entity.last4;
    dto.brand = entity.brand;
    dto.currency = entity.currency;
    dto.status = entity.status;
    dto.spendingLimit = entity.spendingLimit;
    dto.balance = entity.balance;
    dto.billingAddress = entity.billingAddress;
    dto.createdAt = entity.createdAt;
    dto.terminatedAt = entity.terminatedAt;
    return dto;
  }
}
