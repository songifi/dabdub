import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PayLinkStatus } from '../entities/pay-link.entity';

export class ListPayLinksQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    enum: [
      PayLinkStatus.ACTIVE,
      PayLinkStatus.PAID,
      PayLinkStatus.CANCELLED,
      PayLinkStatus.EXPIRED,
    ],
  })
  @IsOptional()
  @IsEnum(PayLinkStatus)
  status?: PayLinkStatus;
}
