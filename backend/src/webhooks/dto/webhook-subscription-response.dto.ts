import { ApiProperty } from '@nestjs/swagger';

export class WebhookSubscriptionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'https://example.com/webhook' })
  url!: string;

  @ApiProperty({ type: [String], example: ['transfer.received'] })
  events!: string[];

  @ApiProperty()
  isActive!: boolean;
}

export class CreateWebhookResponseDto extends WebhookSubscriptionResponseDto {
  @ApiProperty({
    description: 'Plaintext signing secret (shown once). Store securely.',
    example: 'a1b2c3d4e5f6...',
  })
  secret!: string;
}

export class RedeliverResponseDto {
  @ApiProperty({ format: 'uuid' })
  deliveryId!: string;
}
