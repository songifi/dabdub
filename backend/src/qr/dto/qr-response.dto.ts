import { ApiProperty } from '@nestjs/swagger';

export class QrResponseDto {
  @ApiProperty({
    description: 'Base64 PNG data URL: data:image/png;base64,...',
    example: 'data:image/png;base64,iVBORw0KGgo...',
  })
  qrDataUrl!: string;

  @ApiProperty({ description: 'Deep link URL encoded in the QR code' })
  paymentUrl!: string;
}
