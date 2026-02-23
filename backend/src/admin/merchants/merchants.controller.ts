import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../auth/guards/admin-jwt.guard';
import { ApiAdminAuth } from '../../common/decorators/swagger/api-admin-auth.decorator';
import { ListMerchantsQueryDto } from './dto/list-merchants-query.dto';
import { MerchantsService } from './merchants.service';

@ApiTags('Admin - Merchants')
@Controller('api/v1/merchants')
@UseGuards(AdminJwtGuard)
@ApiAdminAuth()
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Get()
  @ApiOperation({
    summary: 'List merchants with advanced filtering, search, and sorting',
  })
  listMerchants(@Query() query: ListMerchantsQueryDto) {
    return this.merchantsService.listMerchants(query);
  }
}
