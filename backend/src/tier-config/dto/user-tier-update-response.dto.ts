import { ApiProperty } from '@nestjs/swagger';
import { TierName } from '../entities/tier-config.entity';

export class UserTierUpdateResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ enum: TierName })
  tier!: TierName;

  @ApiProperty()
  isActive!: boolean;
}
