import { Controller, Get, Patch, Post, Body, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiResponse,
} from '@nestjs/swagger';
import { MerchantsService } from './merchants.service';
import { UpdateMerchantDto } from './dto/create-merchant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@ApiTags('merchants')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get merchant profile' })
  @ApiOkResponse({ description: 'Merchant profile' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  getProfile(@Request() req: { user: { merchantId: string } }) {
    return this.merchantsService.getProfile(req.user.merchantId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update merchant profile' })
  @ApiOkResponse({ description: 'Updated merchant' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  update(@Request() req: { user: { merchantId: string } }, @Body() dto: UpdateMerchantDto) {
    return this.merchantsService.update(req.user.merchantId, dto);
  }

  @Post('api-keys')
  @ApiOperation({ summary: 'Generate API key' })
  @ApiOkResponse({ description: 'New API key payload' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  generateApiKey(@Request() req: { user: { merchantId: string } }) {
    return this.merchantsService.generateApiKey(req.user.merchantId);
  }
}
