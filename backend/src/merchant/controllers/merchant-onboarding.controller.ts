import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { MerchantOnboardingService } from '../services/merchant-onboarding.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { SuperAdminGuard } from '../../auth/guards/super-admin.guard';
import {
  OnboardingFunnelResponseDto,
  OnboardingMerchantDetailDto,
  OnboardingNudgeRequestDto,
  OnboardingSkipStepRequestDto,
  OnboardingMetricsDto,
  OnboardingListQueryDto,
} from '../dto/merchant-onboarding.dto';

@ApiTags('Onboarding Pipeline')
@Controller('api/v1/onboarding')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MerchantOnboardingController {
  constructor(private readonly onboardingService: MerchantOnboardingService) {}

  @Get('pipeline')
  @UseGuards(PermissionGuard)
  @Permissions('merchants:read')
  @ApiOperation({ summary: 'Get onboarding funnel overview' })
  @ApiResponse({
    status: 200,
    description: 'Funnel stats retrieved',
    type: OnboardingFunnelResponseDto,
  })
  async getFunnelStats(): Promise<OnboardingFunnelResponseDto> {
    return this.onboardingService.getFunnelStats();
  }

  @Get('merchants')
  @UseGuards(PermissionGuard)
  @Permissions('merchants:read')
  @ApiOperation({ summary: 'List merchants in onboarding' })
  @ApiResponse({
    status: 200,
    description: 'Merchants list retrieved',
  })
  async listMerchants(@Query() query: OnboardingListQueryDto) {
    return this.onboardingService.listMerchants(query);
  }

  @Get('merchants/:merchantId')
  @UseGuards(PermissionGuard)
  @Permissions('merchants:read')
  @ApiOperation({ summary: 'Get merchant onboarding detail' })
  @ApiResponse({
    status: 200,
    description: 'Merchant detail retrieved',
    type: OnboardingMerchantDetailDto,
  })
  async getMerchantDetail(
    @Param('merchantId') merchantId: string,
  ): Promise<OnboardingMerchantDetailDto> {
    return this.onboardingService.getMerchantDetail(merchantId);
  }

  @Post('merchants/:merchantId/nudge')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionGuard)
  @Permissions('merchants:write')
  @ApiOperation({ summary: 'Send onboarding nudge email' })
  @ApiResponse({
    status: 200,
    description: 'Nudge email sent',
  })
  async sendNudgeEmail(
    @Param('merchantId') merchantId: string,
    @Body() dto: OnboardingNudgeRequestDto,
  ): Promise<{ message: string }> {
    await this.onboardingService.sendNudgeEmail(merchantId, dto.customMessage);
    return { message: 'Nudge email sent successfully' };
  }

  @Post('merchants/:merchantId/skip-step')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Skip onboarding step (SUPER_ADMIN only)' })
  @ApiResponse({
    status: 200,
    description: 'Step skipped',
  })
  async skipStep(
    @Param('merchantId') merchantId: string,
    @Body() dto: OnboardingSkipStepRequestDto,
  ): Promise<{ message: string }> {
    await this.onboardingService.skipStep(merchantId, dto.step, dto.reason);
    return { message: 'Step skipped successfully' };
  }

  @Get('metrics')
  @UseGuards(PermissionGuard)
  @Permissions('merchants:read')
  @ApiOperation({ summary: 'Get onboarding performance metrics' })
  @ApiResponse({
    status: 200,
    description: 'Metrics retrieved',
    type: OnboardingMetricsDto,
  })
  async getMetrics(): Promise<OnboardingMetricsDto> {
    return this.onboardingService.getMetrics();
  }
}
