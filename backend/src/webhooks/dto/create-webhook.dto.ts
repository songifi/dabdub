import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateWebhookDto {
  @ApiProperty({ example: 'https://example.com/webhooks/cheesepay' })
  @IsString()
  url!: string;

  @ApiProperty({ type: [String], example: ['payment.completed'] })
  @IsArray()
  @IsString({ each: true })
  events!: string[];

  @ApiPropertyOptional({ description: 'Optional shared secret for signing' })
  @IsOptional()
  @IsString()
  secret?: string;
}
