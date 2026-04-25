import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class TestEmailDto {
  @ApiProperty({ example: 'ops@example.com' })
  @IsEmail()
  to!: string;

  @ApiProperty({ example: 'welcome', description: 'Template key passed to the mailer' })
  @IsString()
  @MaxLength(120)
  templateAlias!: string;

  @ApiPropertyOptional({ description: 'Merge fields for the template' })
  @IsOptional()
  @IsObject()
  mergeData?: Record<string, unknown>;
}
