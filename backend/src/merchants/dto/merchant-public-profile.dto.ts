import { ApiProperty } from '@nestjs/swagger';

export class MerchantPublicProfileDto {
  @ApiProperty({ example: 'Yaba Electronics' })
  businessName!: string;

  @ApiProperty({
    example: 'merchant-logos/yaba-electronics.webp',
    nullable: true,
  })
  logoKey!: string | null;

  @ApiProperty({ example: true })
  isVerified!: boolean;
}
