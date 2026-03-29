import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { RatesService } from './rates.service';
import { RateAlertService } from './rate-alert.service';
import { CreateRateAlertDto } from './dto/create-rate-alert.dto';

@ApiTags('rates')
@Controller({ path: 'rates', version: '1' })
export class RatesController {
  constructor(
    private readonly ratesService: RatesService,
    private readonly rateAlertService: RateAlertService,
  ) {}

  @Public()
  @Get('ngn-usdc')
  @ApiOperation({ summary: 'Get current USDC/NGN exchange rate' })
  getRate() {
    return this.ratesService.getRate('USDC', 'NGN');
  }

  @Public()
  @Get('history')
  @ApiOperation({ summary: 'Rate history for last 7 days (hourly data points)' })
  getRateHistory() {
    return this.ratesService.getRateHistory();
  }

  @ApiBearerAuth()
  @Post('alerts')
  @ApiOperation({ summary: 'Create a rate alert' })
  createAlert(@Req() req: any, @Body() dto: CreateRateAlertDto) {
    return this.rateAlertService.create(req.user.id, dto);
  }

  @ApiBearerAuth()
  @Get('alerts')
  @ApiOperation({ summary: "Get user's rate alerts with current distance from target" })
  async getAlerts(@Req() req: any) {
    const rateData = await this.ratesService.getRate('USDC', 'NGN').catch(() => null);
    const currentRate = rateData ? parseFloat(rateData.rate) : null;

    if (currentRate !== null) {
      return this.rateAlertService.getAlertsWithRate(req.user.id, currentRate);
    }
    return this.rateAlertService.getAlerts(req.user.id);
  }

  @ApiBearerAuth()
  @Delete('alerts/:id')
  @ApiOperation({ summary: 'Cancel a rate alert' })
  cancelAlert(@Req() req: any, @Param('id') id: string) {
    return this.rateAlertService.cancel(id, req.user.id);
  }
}
