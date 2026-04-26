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
import { NotificationPrefsService } from '../notifications/notification-prefs.service';
import { UpdateNotificationPrefsDto, NotificationPrefsResponseDto } from '../notifications/dto/notification-prefs.dto';

@ApiTags('merchants')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('merchants')
export class MerchantsController {
  constructor(
    private readonly merchantsService: MerchantsService,
    private readonly notificationPrefsService: NotificationPrefsService,
  ) {}

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

  @Get('me/notification-prefs')
  @ApiOperation({ summary: 'Get notification preferences' })
  @ApiOkResponse({ type: NotificationPrefsResponseDto, description: 'Current notification preferences per channel and event' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  getNotificationPrefs(
    @Request() req: { user: { merchantId: string } },
  ): Promise<NotificationPrefsResponseDto> {
    return this.notificationPrefsService.getPrefs(req.user.merchantId);
  }

  @Patch('me/notification-prefs')
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiOkResponse({ type: NotificationPrefsResponseDto, description: 'Updated notification preferences' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiBadRequestResponse({ description: 'Validation failed or attempted to disable in_app channel' })
  updateNotificationPrefs(
    @Request() req: { user: { merchantId: string } },
    @Body() dto: UpdateNotificationPrefsDto,
  ): Promise<NotificationPrefsResponseDto> {
    return this.notificationPrefsService.updatePrefs(req.user.merchantId, dto);
  }
}
