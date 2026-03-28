import { Controller, Get, Query, SetMetadata, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminRole } from '../admin/entities/admin.entity';
import { FeedbackService } from './feedback.service';
import { AdminFeedbackQueryDto } from './dto/admin-feedback-query.dto';

@ApiTags('admin-feedback')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller({ path: 'admin/feedback', version: '1' })
export class AdminFeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get()
  @SetMetadata('roles', [AdminRole.ADMIN, AdminRole.SUPERADMIN])
  @ApiOperation({ summary: 'Admin: list feedback with filters' })
  @ApiResponse({ status: 200 })
  list(@Query() query: AdminFeedbackQueryDto) {
    return this.feedbackService.listFeedback(query);
  }

  @Get('aggregates')
  @SetMetadata('roles', [AdminRole.ADMIN, AdminRole.SUPERADMIN])
  @ApiOperation({ summary: 'Admin: feedback aggregates and NPS' })
  @ApiResponse({ status: 200 })
  aggregates() {
    return this.feedbackService.getAggregates();
  }

  @Get('detractors')
  @SetMetadata('roles', [AdminRole.ADMIN, AdminRole.SUPERADMIN])
  @ApiOperation({ summary: 'Admin: list detractor feedback items' })
  @ApiResponse({ status: 200 })
  detractors(@Query() query: AdminFeedbackQueryDto) {
    return this.feedbackService.getDetractors({
      page: query.page,
      limit: query.limit,
    });
  }
}
