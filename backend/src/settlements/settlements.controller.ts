import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiResponse,
} from '@nestjs/swagger';
import { SettlementsService } from './settlements.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@ApiTags('settlements')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('settlements')
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Get()
  @ApiOperation({ summary: 'List settlements' })
  @ApiOkResponse({ description: 'Paginated settlements' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  findAll(
    @Request() req: { user: { merchantId: string } },
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.settlementsService.findAll(req.user.merchantId, +page, +limit);
  }
}
