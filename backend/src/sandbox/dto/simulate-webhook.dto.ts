import { IsUUID, IsEnum, IsOptional, IsObject } from 'class-validator';
import { WebhookEvent } from '../../database/entities/webhook-configuration.entity';

export class SimulateWebhookDto {
  @IsUUID()
  merchantId: string;

  @IsEnum(WebhookEvent)
  event: WebhookEvent;

  @IsOptional()
  @IsObject()
  overridePayload?: Record<string, unknown>;
}
