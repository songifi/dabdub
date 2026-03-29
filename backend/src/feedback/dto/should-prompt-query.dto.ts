import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum FeedbackPromptTrigger {
  TRANSACTION_RATING = 'transaction_rating',
  NPS = 'nps',
  FEATURE_REQUEST = 'feature_request',
  BUG_REPORT = 'bug_report',
  GENERAL = 'general',
}

export class ShouldPromptQueryDto {
  @ApiProperty({ enum: FeedbackPromptTrigger })
  @IsEnum(FeedbackPromptTrigger)
  trigger!: FeedbackPromptTrigger;
}