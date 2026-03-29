import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as crypto from 'crypto';
import { OffRampService } from './offramp.service';
import { Public } from '../auth/decorators/public.decorator';

interface PaystackTransferEvent {
  event: string;
  data: {
    id: number;
    transfer_code: string;
    reference: string;
    reason: string;
    status: string;
  };
}

@ApiTags('Off-Ramp Webhooks')
@Controller('offramp/webhooks')
export class OffRampWebhookController {
  private readonly logger = new Logger(OffRampWebhookController.name);

  constructor(
    private readonly offRampService: OffRampService,
    private readonly configService: ConfigService,
  ) {}

  @Post('paystack')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Receive Paystack transfer webhook events' })
  async handlePaystackWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature: string,
  ): Promise<{ received: boolean }> {
    // 1. Verify signature
    const secret = this.configService.get<string>('PAYSTACK_SECRET_KEY');
    if (!secret) {
      this.logger.error('PAYSTACK_SECRET_KEY not configured — rejecting webhook');
      throw new BadRequestException('Webhook not configured');
    }

    const rawBody = req.rawBody ?? Buffer.from('');
    const expected = crypto
      .createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex');

    if (!signature || signature !== expected) {
      this.logger.warn('Paystack webhook: invalid signature');
      throw new BadRequestException('Invalid webhook signature');
    }

    // 2. Parse and dispatch
    let payload: PaystackTransferEvent;
    try {
      payload = JSON.parse(rawBody.toString()) as PaystackTransferEvent;
    } catch {
      throw new BadRequestException('Invalid JSON payload');
    }

    const { event, data } = payload;
    const reference = data?.reference ?? data?.reason ?? '';
    const transferCode = data?.transfer_code ?? '';

    this.logger.log(`Paystack webhook received: ${event} for ref=${reference}`);

    try {
      if (event === 'transfer.success') {
        await this.offRampService.handlePaystackTransferSuccess(transferCode, reference);
      } else if (event === 'transfer.failed' || event === 'transfer.reversed') {
        await this.offRampService.handlePaystackTransferFailed(transferCode, reference);
      } else {
        this.logger.debug(`Paystack webhook: unhandled event type '${event}' — ignoring`);
      }
    } catch (err: any) {
      // Log but return 200 so Paystack won't retry endlessly
      this.logger.error(`Error processing Paystack webhook ${event}: ${err.message}`);
    }

    return { received: true };
  }
}
