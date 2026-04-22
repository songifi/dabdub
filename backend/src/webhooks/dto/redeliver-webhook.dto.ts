import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RedeliverWebhookDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'If omitted, redelivers the latest delivery' })
  @IsOptional()
  @IsString()
  deliveryId?: string;
}

