import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { ShouldPromptQueryDto } from './dto/should-prompt-query.dto';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@ApiTags('feedback')
@ApiBearerAuth()
@Controller({ path: 'feedback', version: '1' })
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get('should-prompt')
  @ApiOperation({ summary: 'Check whether feedback prompt should be shown' })
  @ApiResponse({ status: 200 })
  shouldPrompt(
    @Req() req: any,
    @Query() query: ShouldPromptQueryDto,
  ) {
    return this.feedbackService.shouldPrompt(req.user.id, query.trigger);
  }

  @Post()
  @ApiOperation({ summary: 'Submit user feedback' })
  @ApiResponse({ status: 201 })
  submit(
    @Req() req: any,
    @Body() dto: CreateFeedbackDto,
  ) {
    return this.feedbackService.submit(req.user.id, dto);
  }
}
