import { IsOptional, IsString, IsPhoneNumber, MinLength } from 'class-validator';

export class UpdateOwnProfileDto {
    @IsOptional()
    @IsString()
    @MinLength(2)
    firstName?: string;

    @IsOptional()
    @IsString()
    @MinLength(2)
    lastName?: string;

    @IsOptional()
    @IsString()
    @IsPhoneNumber()
    phoneNumber?: string;
}
