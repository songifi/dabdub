import { Controller, Get, Patch, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MerchantsService } from './merchants.service';
import { UpdateMerchantDto } from './dto/create-merchant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@ApiTags('merchants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get merchant profile' })
  getProfile(@Request() req) {
    return this.merchantsService.getProfile(req.user.merchantId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update merchant profile' })
  update(@Request() req, @Body() dto: UpdateMerchantDto) {
    return this.merchantsService.update(req.user.merchantId, dto);
  }

  @Post('api-keys')
  @ApiOperation({ summary: 'Generate API key' })
  generateApiKey(@Request() req) {
    return this.merchantsService.generateApiKey(req.user.merchantId);
  }
}
