import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SettlementsService } from './settlements.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('settlements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settlements')
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Get()
  @ApiOperation({ summary: 'List settlements' })
  findAll(@Request() req, @Query() pagination: PaginationDto) {
    return this.settlementsService.findAll(req.user.merchantId, pagination.page, pagination.limit);
  }
}
