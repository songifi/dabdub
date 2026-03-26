import { ApiProperty } from '@nestjs/swagger';

export class QrResponseDto {
  @ApiProperty({ example: 'data:image/png;base64,iVBORw0KGgo...', description: 'Base64 PNG data URL' })
  qrDataUrl!: string;

  @ApiProperty({ example: 'cheesepay://pay?to=alice&amount=50', description: 'Deep link URL encoded in the QR code' })
  paymentUrl!: string;
}
