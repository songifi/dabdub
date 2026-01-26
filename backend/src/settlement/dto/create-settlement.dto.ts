import { IsNotEmpty, IsNumber, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BankDetailsDto {
    @IsString()
    @IsNotEmpty()
    accountNumber!: string;

    @IsString()
    @IsNotEmpty()
    routingNumber!: string;

    @IsString()
    @IsNotEmpty()
    name!: string;

    @IsString()
    @IsNotEmpty()
    bankName!: string;
}

export class CreateSettlementDto {
    @IsUUID()
    @IsNotEmpty()
    paymentRequestId!: string;

    @IsUUID()
    @IsNotEmpty()
    merchantId!: string;

    @IsNumber()
    @IsNotEmpty()
    amount!: number;

    @IsString()
    @IsNotEmpty()
    currency!: string;

    @IsString()
    @IsNotEmpty()
    sourceCurrency!: string;

    @ValidateNested()
    @Type(() => BankDetailsDto)
    @IsNotEmpty()
    bankDetails!: BankDetailsDto;
}
