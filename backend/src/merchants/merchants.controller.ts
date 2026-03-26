import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { User } from '../users/entities/user.entity';
import { MerchantPublicProfileDto } from './dto/merchant-public-profile.dto';
import { RegisterMerchantDto } from './dto/register-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { Merchant } from './entities/merchant.entity';
import { MerchantsService } from './merchants.service';

type AuthenticatedRequest = Request & { user: User };

@ApiTags('merchants')
@ApiBearerAuth()
@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Create a merchant profile for the authenticated user',
  })
  @ApiResponse({ status: 201, type: Merchant })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Merchant profile already exists' })
  register(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RegisterMerchantDto,
  ): Promise<Merchant> {
    return this.merchantsService.register(req.user, dto);
  }

  @Get('me')
  @ApiOperation({
    summary: 'Get current merchant profile (merchant accounts only)',
  })
  @ApiResponse({ status: 200, type: Merchant })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Merchant account required' })
  getMe(@Req() req: AuthenticatedRequest): Promise<Merchant> {
    return this.merchantsService.getMe(req.user);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current merchant profile' })
  @ApiResponse({ status: 200, type: Merchant })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Merchant account required' })
  updateMe(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateMerchantDto,
  ): Promise<Merchant> {
    return this.merchantsService.updateMe(req.user, dto);
  }

  @Public()
  @Get(':username')
  @ApiOperation({ summary: 'Public merchant profile for pay pages' })
  @ApiResponse({ status: 200, type: MerchantPublicProfileDto })
  @ApiResponse({ status: 404, description: 'Merchant not found' })
  getPublicByUsername(
    @Param('username') username: string,
  ): Promise<MerchantPublicProfileDto> {
    return this.merchantsService.getPublicByUsername(username);
  }
}
