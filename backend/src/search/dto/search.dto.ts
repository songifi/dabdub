import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { PublicProfileDto } from '../../profile/dto/public-profile.dto';
import { ActivityFeedItemDto } from '../../activity/dto/activity-feed.dto';
import { PayLink } from '../../paylink/entities/pay-link.entity';

export type SearchType = 'users' | 'transactions' | 'paylinks';

export class SearchQueryDto {
  @ApiProperty({ example: 'temi' })
  @IsString()
  @MinLength(2)
  q!: string;

  @ApiPropertyOptional({ example: 'users,transactions' })
  @IsOptional()
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.split(',').map((s) => s.trim()) : value,
  )
  types?: SearchType[];
}

export class SearchResultsDto {
  @ApiProperty({ type: [PublicProfileDto] }) users!: PublicProfileDto[];
  @ApiProperty({ type: [ActivityFeedItemDto] }) transactions!: ActivityFeedItemDto[];
  @ApiProperty({ type: [PayLink] }) paylinks!: PayLink[];
  @ApiProperty({ example: 'temi' }) query!: string;
  @ApiProperty({ example: 7 }) totalResults!: number;
}
