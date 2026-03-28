import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CreatePayLinkDto } from '../paylink/dto/create-pay-link.dto';
import { SandboxApiKeyGuard } from './sandbox-api-key.guard';
import { SandboxSimulateDepositDto } from './dto/sandbox-simulate-deposit.dto';
import { SandboxSimulatePaymentDto } from './dto/sandbox-simulate-payment.dto';
import { SandboxService } from './sandbox.service';
import type { SandboxRequest } from './types/sandbox-request.type';

@ApiTags('sandbox')
@Public()
@UseGuards(SandboxApiKeyGuard)
@ApiHeader({
  name: 'X-API-Key',
  required: true,
  description: 'Sandbox API key (ck_test_...)',
})
@Controller({ path: 'sandbox', version: '1' })
export class SandboxController {
  constructor(private readonly sandbox: SandboxService) {}

  @Post('paylinks')
  @ApiOperation({ summary: 'Create a sandbox PayLink' })
  @ApiResponse({ status: 201 })
  createSandboxPayLink(
    @Req() req: SandboxRequest,
    @Body() dto: CreatePayLinkDto,
  ) {
    return this.sandbox.createSandboxPayLink(req.sandboxAuth.merchantId, dto);
  }

  @Post('simulate/payment')
  @ApiOperation({
    summary: 'Simulate a sandbox PayLink payment and trigger sandbox webhook delivery',
  })
  @ApiResponse({ status: 200 })
  simulatePayment(
    @Req() req: SandboxRequest,
    @Body() dto: SandboxSimulatePaymentDto,
  ) {
    return this.sandbox.simulatePayment(req.sandboxAuth.merchantId, dto.tokenId);
  }

  @Post('simulate/deposit')
  @ApiOperation({ summary: 'Credit sandbox USDC balance' })
  @ApiResponse({ status: 200 })
  simulateDeposit(
    @Req() req: SandboxRequest,
    @Body() dto: SandboxSimulateDepositDto,
  ) {
    return this.sandbox.simulateDeposit(req.sandboxAuth.merchantId, dto.amountUsdc);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get sandbox USDC balance' })
  @ApiResponse({ status: 200 })
  getBalance(@Req() req: SandboxRequest) {
    return this.sandbox.getBalance(req.sandboxAuth.merchantId);
  }

  @Post('reset')
  @ApiOperation({ summary: 'Reset sandbox balance and clear sandbox transaction history' })
  @ApiResponse({ status: 200 })
  reset(@Req() req: SandboxRequest) {
    return this.sandbox.resetBalance(req.sandboxAuth.merchantId);
  }
}
