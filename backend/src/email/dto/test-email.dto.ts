import { IsEmail, IsString, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TestEmailDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  to!: string;

  @ApiProperty({ example: 'welcome' })
  @IsString()
  templateAlias!: string;

  @ApiProperty({ required: false, example: { name: 'Alice' } })
  @IsOptional()
  @IsObject()
  mergeData?: Record<string, unknown>;
}
