import { IsOptional, IsString } from 'class-validator';

export class RedeliverWebhookDto {
  @IsOptional()
  @IsString()
  deliveryId?: string;
}

