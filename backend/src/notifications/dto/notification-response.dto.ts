import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '../notifications.types';

export class NotificationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ enum: NotificationType })
  type!: NotificationType;

  @ApiProperty({ maxLength: 100 })
  title!: string;

  @ApiProperty({ maxLength: 300 })
  body!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  metadata!: Record<string, unknown>;

  @ApiProperty()
  isRead!: boolean;

  @ApiProperty({ type: String, nullable: true })
  readAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class NotificationsListResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  items!: NotificationResponseDto[];

  @ApiProperty({ type: String, nullable: true, description: 'Opaque cursor for next page' })
  nextCursor!: string | null;
}

export class UnreadCountResponseDto {
  @ApiProperty({ example: 3 })
  count!: number;
}
