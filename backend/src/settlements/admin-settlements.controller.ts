import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { SettlementsService } from './settlements.service';
import { AdminSettlementsQueryDto } from './dto/admin-settlements-query.dto';

@Controller('api/v1/admin/settlements')
@UseGuards(JwtGuard)
export class AdminSettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Get()
  async findAll(@Query() query: AdminSettlementsQueryDto) {
    return this.settlementsService.findAllAdmin(query);
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  async retrySettlement(@Param('id') id: string) {
    const result = await this.settlementsService.retrySettlement(id);
    if (!result.success) {
      throw new BadRequestException(result.message);
    }
    return { message: 'Settlement retry initiated successfully' };
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approveSettlement(@Param('id') id: string) {
    const result = await this.settlementsService.approveSettlement(id);
    if (!result.success) {
      throw new BadRequestException(result.message);
    }
    return { message: 'Settlement approved successfully' };
  }
}