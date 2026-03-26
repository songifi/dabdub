import {
  Controller,
  ForbiddenException,
  Param,
  Patch,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Merchant } from './entities/merchant.entity';
import { MerchantsService } from './merchants.service';

@ApiTags('admin/merchants')
@ApiBearerAuth()
@Controller('admin/merchants')
export class MerchantsAdminController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Patch(':id/verify')
  @ApiOperation({ summary: 'Verify a merchant profile' })
  @ApiResponse({ status: 200, type: Merchant })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin only' })
  @ApiResponse({ status: 404, description: 'Merchant not found' })
  verify(@Param('id') id: string, @Req() req: Request): Promise<Merchant> {
    const user = (req as Request & { user?: { isAdmin?: boolean } }).user;
    if (!user?.isAdmin) {
      throw new ForbiddenException('Admin only');
    }

    return this.merchantsService.verifyMerchant(id);
  }
}
