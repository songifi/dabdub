import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Headers,
  ForbiddenException,
  Request,
} from '@nestjs/common';
import { FiatCurrencyConfigService } from './fiat-currency-config.service';
import {
  AddFiatCurrencyDto,
  UpdateFiatCurrencyDto,
  UpdateBankDetailsDto,
} from './dtos/fiat-currency-config.dto';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { RequirePermissionGuard } from '../auth/guards/require-permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { AdminTwoFactorService } from '../auth/services/admin-two-factor.service';

@Controller('api/v1/config/currencies')
@UseGuards(AdminJwtGuard, RequirePermissionGuard)
export class FiatCurrencyConfigController {
  constructor(
    private readonly currencyService: FiatCurrencyConfigService,
    private readonly twoFactorService: AdminTwoFactorService,
  ) {}

  @Get()
  @RequirePermission('config:read')
  async listCurrencies() {
    return this.currencyService.findAll();
  }

  @Get(':code')
  @RequirePermission('config:read')
  async getCurrency(@Param('code') code: string) {
    return this.currencyService.findByCode(code);
  }

  @Post()
  @UseGuards(SuperAdminGuard)
  @RequirePermission('config:write')
  async addCurrency(@Body() dto: AddFiatCurrencyDto) {
    return this.currencyService.create(dto);
  }

  @Patch(':code')
  @RequirePermission('config:write')
  async updateCurrency(
    @Param('code') code: string,
    @Body() dto: UpdateFiatCurrencyDto,
  ) {
    if (dto.operatingHours) {
      this.currencyService.validateOperatingHours(dto.operatingHours);
    }
    return this.currencyService.update(code, dto);
  }

  @Patch(':code/bank-details')
  @UseGuards(SuperAdminGuard)
  @RequirePermission('config:write')
  async updateBankDetails(
    @Param('code') code: string,
    @Body() dto: UpdateBankDetailsDto,
    @Headers('X-2FA-Code') twoFactorCode: string,
    @Request() req: any,
  ) {
    if (!twoFactorCode) {
      throw new ForbiddenException('2FA verification code required');
    }

    const adminId = req.user.id;
    const isValid = await this.twoFactorService.verify2FACode(adminId, twoFactorCode);

    if (!isValid) {
      throw new ForbiddenException('Invalid 2FA verification code');
    }

    return this.currencyService.updateBankDetails(
      code,
      dto,
      adminId,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Get(':code/rate-history')
  @RequirePermission('config:read')
  async getRateHistory(@Param('code') code: string) {
    return this.currencyService.getRateHistory(code);
  }

  @Post(':code/validate-rate-feed')
  @RequirePermission('config:write')
  async validateRateFeed(@Param('code') code: string) {
    return this.currencyService.validateRateFeed(code);
  }
}
