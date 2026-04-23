import { Controller, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AmlService } from './aml.service';
import { AmlFlagStatus } from './entities/aml-flag.entity';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

class ReviewFlagDto {
  status: AmlFlagStatus;
  reviewedBy: string;
  note?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('admin/aml')
export class AmlController {
  constructor(private readonly amlService: AmlService) {}

  @Get()
  findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.amlService.findAll(+page, +limit);
  }

  @Get('pending')
  findPending(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.amlService.findPending(+page, +limit);
  }

  @Get('merchant/:merchantId')
  findByMerchant(@Param('merchantId') merchantId: string) {
    return this.amlService.findByMerchant(merchantId);
  }

  @Patch(':id/review')
  review(@Param('id') id: string, @Body() dto: ReviewFlagDto) {
    return this.amlService.review(id, dto.status, dto.reviewedBy, dto.note);
  }
}
