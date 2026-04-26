import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { NotificationChannel, NotificationEventType } from '../entities/notification-preference.entity';

export class NotificationPrefItemDto {
  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({ enum: NotificationEventType })
  @IsEnum(NotificationEventType)
  eventType: NotificationEventType;

  @ApiProperty()
  @IsBoolean()
  enabled: boolean;
}

export class UpdateNotificationPrefsDto {
  @ApiProperty({ type: [NotificationPrefItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationPrefItemDto)
  preferences: NotificationPrefItemDto[];
}

export class NotificationPrefResponseItemDto {
  @ApiProperty({ enum: NotificationChannel })
  channel: NotificationChannel;

  @ApiProperty({ enum: NotificationEventType })
  eventType: NotificationEventType;

  @ApiProperty()
  enabled: boolean;

  @ApiPropertyOptional({ description: 'in_app channel is always enabled and cannot be disabled' })
  readonly?: boolean;
}

export class NotificationPrefsResponseDto {
  @ApiProperty({ type: [NotificationPrefResponseItemDto] })
  preferences: NotificationPrefResponseItemDto[];
}
