import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum FeedbackPromptTrigger {
  TRANSACTION_RATING = 'transaction_rating',
  FEATURE_FEEDBACK = 'feature_feedback',
}

export class ShouldPromptQueryDto {
  @ApiProperty({ enum: FeedbackPromptTrigger })
  @IsEnum(FeedbackPromptTrigger)
  trigger!: FeedbackPromptTrigger;
}