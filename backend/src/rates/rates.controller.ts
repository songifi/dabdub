import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { RatesService } from './rates.service';

@ApiTags('rates')
@Controller('rates')
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

  @Public()
  @Get('ngn-usdc')
  @ApiOperation({ summary: 'Get current USDC/NGN exchange rate' })
  getRate(): Promise<{ rate: string; fetchedAt: Date; source: string; isStale: boolean }> {
    return this.ratesService.getRate('USDC', 'NGN');
  }
}
