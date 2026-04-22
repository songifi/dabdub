import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TierName } from '../entities/tier-config.entity';

export class UpdateUserTierDto {
  @ApiProperty({ enum: TierName, example: TierName.GOLD })
  @IsEnum(TierName)
  tier!: TierName;
}
