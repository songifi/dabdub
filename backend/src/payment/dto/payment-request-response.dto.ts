import { ApiProperty } from '@nestjs/swagger';

export class PaymentRequestResponseDto {
  @ApiProperty({ description: 'Unique payment request ID' })
  paymentId!: string;

  @ApiProperty({ description: 'Deposit address for the selected chain' })
  depositAddress!: string;

  @ApiProperty({
    description: 'USDC amount (from fiat amount and live exchange rate)',
    example: 100.5,
  })
  usdcAmount!: number;

  @ApiProperty({
    description: 'Payload for QR code (e.g. EIP-681 or JSON for wallet)',
  })
  qrPayload!: string;

  @ApiProperty({
    description: 'ISO 8601 expiration timestamp',
    example: '2025-02-26T13:00:00.000Z',
  })
  expiresAt!: string;
}
