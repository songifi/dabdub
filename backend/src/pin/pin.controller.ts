import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { User } from '../users/entities/user.entity';
import { ChangePinDto } from './dto/change-pin.dto';
import { ResetPinDto } from './dto/reset-pin.dto';
import { SetPinDto } from './dto/set-pin.dto';
import { PinService } from './pin.service';

type AuthenticatedRequest = Request & { user: User };

@ApiTags('pin')
@ApiBearerAuth()
@Controller({ path: 'pin', version: '1' })
export class PinController {
  constructor(private readonly pinService: PinService) {}

  @Get('status')
  @ApiOperation({ summary: 'PIN status and lock state' })
  @ApiResponse({ status: 200 })
  status(@Req() req: AuthenticatedRequest) {
    return this.pinService.getStatus(req.user.id);
  }

  @Post('set')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Set transaction PIN (once, during onboarding)',
  })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 409, description: 'PIN already set' })
  async setPin(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SetPinDto,
  ): Promise<void> {
    await this.pinService.setInitialPin(req.user.id, dto.pin);
  }

  @Patch('change')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change PIN using the current PIN' })
  @ApiResponse({ status: 204 })
  async changePin(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePinDto,
  ): Promise<void> {
    await this.pinService.changePin(
      req.user.id,
      dto.currentPin,
      dto.newPin,
    );
  }

  @Post('reset/request-code')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Send a PIN reset OTP (SMS) — type pin_reset',
  })
  @ApiResponse({ status: 204 })
  async requestResetCode(@Req() req: AuthenticatedRequest): Promise<void> {
    await this.pinService.requestPinResetCode(req.user);
  }

  @Post('reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset PIN using OTP (pin_reset)' })
  @ApiResponse({ status: 204 })
  async resetPin(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ResetPinDto,
  ): Promise<void> {
    await this.pinService.resetPin(req.user.id, dto.newPin, dto.otpCode);
  }
}
