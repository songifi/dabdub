import { ApiProperty } from '@nestjs/swagger';
import { QrResponseDto } from './qr-response.dto';

export class QrUserResponseDto extends QrResponseDto {
  @ApiProperty({
    description: 'Fallback URL when QR cannot be scanned in-app',
    example: 'https://app.example.com/pay/alice',
  })
  webFallbackUrl!: string;
}
