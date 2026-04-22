import { ApiProperty } from '@nestjs/swagger';

export class WebhookDeliveryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ format: 'uuid' })
  subscriptionId!: string;

  @ApiProperty({ example: 'transfer.received' })
  event!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  payload!: Record<string, unknown>;

  @ApiProperty({ type: Number, nullable: true })
  responseStatus!: number | null;

  @ApiProperty({ type: String, nullable: true })
  responseBody!: string | null;

  @ApiProperty()
  attemptCount!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  deliveredAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  nextRetryAt!: Date;
}
