import { ArrayNotEmpty, IsArray, IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WEBHOOK_EVENTS } from '../webhooks.events';

export class CreateWebhookDto {
  @ApiProperty({ example: 'https://example.com/webhooks/cheese' })
  @IsString()
  url!: string;

  @ApiProperty({ enum: WEBHOOK_EVENTS, isArray: true, example: ['transfer.received'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events!: string[];
}

