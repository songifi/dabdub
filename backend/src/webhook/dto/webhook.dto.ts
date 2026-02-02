import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUrl,
  IsArray,
  IsEnum,
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
} from 'class-validator';
import { WebhookEvent, WebhookStatus } from '../../database/entities/webhook-configuration.entity';

export class CreateWebhookDto {
  @ApiProperty({
    description: 'Webhook endpoint URL',
    example: 'https://example.com/webhooks/settlement',
    format: 'uri',
  })
  @IsUrl()
  url: string;

  @ApiProperty({
    description: 'List of events to subscribe to',
    example: [
      WebhookEvent.PAYMENT_REQUEST_CREATED,
      WebhookEvent.SETTLEMENT_COMPLETED,
    ],
    isArray: true,
    enum: Object.values(WebhookEvent),
  })
  @IsArray()
  @IsEnum(WebhookEvent, { each: true })
  events: WebhookEvent[];

  @ApiPropertyOptional({
    description: 'Custom webhook secret for HMAC signature verification',
    example: 'secret-key-123',
    minLength: 32,
  })
  @IsOptional()
  @IsString()
  secret?: string;

  @ApiPropertyOptional({
    description: 'Webhook status',
    enum: WebhookStatus,
    example: WebhookStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(WebhookStatus)
  status?: WebhookStatus;

  @ApiPropertyOptional({
    description: 'Custom headers to send with the webhook',
    example: { 'X-Custom-Header': 'value' },
  })
  @IsOptional()
  headers?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Maximum number of retries',
    example: 3,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxRetries?: number;

  @ApiPropertyOptional({
    description: 'Base retry delay in milliseconds',
    example: 1000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  retryDelay?: number;

  @ApiPropertyOptional({
    description: 'Webhook timeout in milliseconds (max 5000)',
    example: 5000,
  })
  @IsOptional()
  @IsInt()
  @Min(1000)
  timeout?: number;

  @ApiPropertyOptional({
    description: 'Maximum consecutive failures before disabling webhook',
    example: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxConsecutiveFailures?: number;

  @ApiPropertyOptional({
    description: 'Enable event batching for this webhook',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  batchEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Maximum number of events per batch',
    example: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  batchMaxSize?: number;

  @ApiPropertyOptional({
    description: 'Batching window in milliseconds',
    example: 2000,
  })
  @IsOptional()
  @IsInt()
  @Min(100)
  batchWindowMs?: number;
}

export class WebhookResponseDto {
  @ApiProperty({
    description: 'Webhook configuration unique identifier',
    example: 'wh_123456789',
  })
  id: string;

  @ApiProperty({
    description: 'Webhook endpoint URL',
    example: 'https://example.com/webhooks/settlement',
  })
  url: string;

  @ApiProperty({
    description: 'Subscribed events',
    isArray: true,
  })
  events: WebhookEvent[];

  @ApiProperty({
    description: 'Webhook status',
    enum: WebhookStatus,
    example: WebhookStatus.ACTIVE,
  })
  status: WebhookStatus;

  @ApiProperty({
    description: 'Last successful delivery timestamp',
    example: '2024-01-20T10:30:00Z',
  })
  lastDeliveredAt: Date;

  @ApiProperty({
    description: 'Number of consecutive failed delivery attempts',
    example: 0,
  })
  consecutiveFailures: number;

  @ApiProperty({
    description: 'Maximum consecutive failures allowed',
    example: 5,
  })
  maxConsecutiveFailures: number;

  @ApiProperty({
    description: 'Configuration creation timestamp',
    example: '2024-01-20T10:00:00Z',
  })
  createdAt: Date;
}

export class WebhookTestRequestDto {
  @ApiPropertyOptional({
    description: 'Optional custom payload to send with the test event',
    example: { ping: 'pong' },
  })
  @IsOptional()
  payload?: Record<string, unknown>;
}

export class WebhookVerificationRequestDto {
  @ApiProperty({
    description: 'Raw payload that was received',
    example: { id: 'evt_123', event: 'payment_request.created' },
  })
  payload: Record<string, unknown>;

  @ApiProperty({
    description: 'Signature header value (e.g. t=123,v1=abcdef)',
    example: 't=1700000000,v1=abcdef123',
  })
  @IsString()
  signature: string;
}
