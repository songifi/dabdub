import { ArrayNotEmpty, IsArray, IsIn, IsString } from 'class-validator';
import { WEBHOOK_EVENTS } from '../webhooks.events';

export class CreateWebhookDto {
  @IsString()
  url!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events!: string[];
}
