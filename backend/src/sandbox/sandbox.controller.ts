import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
} from '@nestjs/common';
import { SandboxService } from './sandbox.service';
import { UpdateSandboxConfigDto } from './dto/update-sandbox-config.dto';
import { TopUpDto } from './dto/top-up.dto';
import { SimulateTransactionDto } from './dto/simulate-transaction.dto';
import { SimulateWebhookDto } from './dto/simulate-webhook.dto';

@Controller('api/v1/sandbox')
export class SandboxController {
  constructor(private readonly sandboxService: SandboxService) {}

  @Get('merchants')
  listMerchants() {
    return this.sandboxService.listMerchants();
  }

  @Get('merchants/:id/config')
  getConfig(@Param('id') id: string) {
    return this.sandboxService.getConfig(id);
  }

  @Patch('merchants/:id/config')
  updateConfig(@Param('id') id: string, @Body() updateDto: UpdateSandboxConfigDto) {
    return this.sandboxService.updateConfig(id, updateDto);
  }

  @Post('merchants/:id/reset')
  resetSandbox(@Param('id') id: string) {
    return this.sandboxService.resetMerchantSandbox(id);
  }

  @Post('merchants/:id/top-up')
  topUp(@Param('id') id: string, @Body() topUpDto: TopUpDto) {
    return this.sandboxService.topUp(id, topUpDto);
  }

  @Post('simulate/transaction')
  simulateTransaction(@Body() dto: SimulateTransactionDto) {
    return this.sandboxService.simulateTransaction(dto);
  }

  @Post('simulate/webhook')
  simulateWebhook(@Body() dto: SimulateWebhookDto) {
    return this.sandboxService.simulateWebhook(dto);
  }

  @Get('activity')
  getActivityFeed() {
    return this.sandboxService.getActivityFeed();
  }

  @Get('stats')
  getStats() {
    return this.sandboxService.getStats();
  }
}
