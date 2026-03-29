import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { TierName } from '../entities/tier-config.entity';

export class InitiateTierUpgradeDto {
  @ApiProperty({ enum: TierName, example: TierName.GOLD })
  @IsEnum(TierName)
  targetTier!: TierName;
}
