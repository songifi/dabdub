import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiResponse,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { RatesService } from './rates.service';
import { RateQuoteResponseDto } from './dto/rate-quote-response.dto';

@ApiTags('rates')
@Controller('rates')
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

  @Public()
  @Get('ngn-usdc')
  @ApiOperation({ summary: 'Get current USDC/NGN exchange rate' })
  @ApiOkResponse({ type: RateQuoteResponseDto })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  getRate(): Promise<RateQuoteResponseDto> {
    return this.ratesService.getRate('USDC', 'NGN');
  }
}
