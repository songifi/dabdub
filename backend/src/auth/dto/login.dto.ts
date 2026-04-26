import { IsEmail, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({ example: "merchant@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "SecurePass123!" })
  @IsString()
  password: string;
}
