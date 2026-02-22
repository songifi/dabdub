import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MerchantNoteService } from '../services/merchant-note.service';
import { FollowUpNoteDto } from '../dto/merchant-note.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { UserEntity } from '../../database/entities/user.entity';

@ApiTags('Follow-ups')
@Controller('merchants/follow-ups')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MerchantFollowUpController {
  constructor(private readonly noteService: MerchantNoteService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions('merchants:read')
  @ApiOperation({
    summary: 'Get follow-up reminders for next 7 days or overdue',
  })
  @ApiResponse({
    status: 200,
    description: 'Follow-up reminders retrieved successfully',
    type: [FollowUpNoteDto],
  })
  async getFollowUps(
    @CurrentUser() user: UserEntity,
  ): Promise<FollowUpNoteDto[]> {
    return this.noteService.getFollowUps(user.id, user.role);
  }
}
