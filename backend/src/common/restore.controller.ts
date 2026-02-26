import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { SoftDeleteService } from './soft-delete.service';
import { Split } from '../entities/split.entity';
import { Participant } from '../entities/participant.entity';
// Admin guard: uncomment and use when auth is configured
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../security/roles.guard';
// import { Roles } from '../security/roles.decorator';

@ApiTags('Admin')
@Controller('admin')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles('admin')
// @ApiBearerAuth()
export class RestoreController {
  constructor(private readonly softDeleteService: SoftDeleteService) {}

  @Post('splits/:id/restore')
  @ApiOperation({ summary: 'Restore a soft-deleted split (admin only)' })
  @ApiParam({ name: 'id', description: 'Split UUID' })
  @ApiResponse({ status: 200, description: 'Split restored' })
  @ApiResponse({ status: 404, description: 'Split not found or not soft-deleted' })
  async restoreSplit(@Param('id') id: string): Promise<Split> {
    return this.softDeleteService.restoreSplit(id);
  }

  @Post('participants/:id/restore')
  @ApiOperation({ summary: 'Restore a soft-deleted participant (admin only)' })
  @ApiParam({ name: 'id', description: 'Participant UUID' })
  @ApiResponse({ status: 200, description: 'Participant restored' })
  @ApiResponse({ status: 404, description: 'Participant not found or not soft-deleted' })
  async restoreParticipant(@Param('id') id: string): Promise<Participant> {
    return this.softDeleteService.restoreParticipant(id);
  }
}
