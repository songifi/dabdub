import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MerchantsService } from './merchants.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { BulkMerchantActionDto, BulkActionResponseDto } from './dto/bulk-merchant-action.dto';
import { MerchantStatus } from './entities/merchant.entity';

@ApiTags('admin/merchants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/merchants')
export class AdminMerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Post('bulk/suspend')
  @ApiOperation({ summary: 'Bulk suspend merchants' })
  @ApiResponse({ type: BulkActionResponseDto })
  async suspendMany(@Request() req, @Body() dto: BulkMerchantActionDto) {
    return this.merchantsService.bulkUpdateStatus(req.user.merchantId, dto, MerchantStatus.SUSPENDED);
  }

  @Post('bulk/activate')
  @ApiOperation({ summary: 'Bulk activate merchants' })
  @ApiResponse({ type: BulkActionResponseDto })
  async activateMany(@Request() req, @Body() dto: BulkMerchantActionDto) {
    return this.merchantsService.bulkUpdateStatus(req.user.merchantId, dto, MerchantStatus.ACTIVE);
  }
}
