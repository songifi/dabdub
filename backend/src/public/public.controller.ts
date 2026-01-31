import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Res,
  Logger,
  UseGuards,
  Header,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiProduces,
} from '@nestjs/swagger';
import { PaymentService } from '../payment/payment.service';
import { ThrottlerGuard } from '@nestjs/throttler';

@ApiTags('Public Payments')
@Controller('api/v1/public')
@UseGuards(ThrottlerGuard)
export class PublicController {
  private readonly logger = new Logger(PublicController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Get('payment/:id')
  @ApiOperation({ summary: 'Get public payment details' })
  @ApiResponse({
    status: 200,
    description: 'Payment details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @Header('Cache-Control', 'public, max-age=300')
  async getPayment(@Param('id') id: string) {
    this.logger.log(`Fetching payment details for id: ${id}`);
    return this.paymentService.getPaymentDetails(id);
  }

  @Get('payment/:id/qr')
  @ApiOperation({ summary: 'Generate QR code for payment' })
  @ApiProduces('image/png')
  @ApiResponse({ status: 200, description: 'QR code generated successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @Header('Cache-Control', 'public, max-age=3600')
  async getQR(@Param('id') id: string, @Res() res: Response) {
    this.logger.log(`Generating QR for payment id: ${id}`);
    const { qrCodeData } = await this.paymentService.generateQrCode(id);
    const qrBuffer = Buffer.from(qrCodeData, 'base64');
    res.setHeader('Content-Type', 'image/png');
    res.send(qrBuffer);
  }

  @Get('payment/:id/status')
  @ApiOperation({ summary: 'Get real-time payment status' })
  @ApiResponse({ status: 200, description: 'Payment status retrieved' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @Header('Cache-Control', 'no-cache')
  async getStatus(@Param('id') id: string) {
    this.logger.log(`Fetching status for payment id: ${id}`);
    return this.paymentService.getPaymentStatus(id);
  }

  @Post('payment/:id/notify')
  @ApiOperation({ summary: 'Handle customer notification callbacks' })
  @ApiResponse({
    status: 200,
    description: 'Notification handled successfully',
  })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async notify(@Param('id') id: string, @Body() data: any) {
    this.logger.log(`Handling notify for payment id: ${id}`);
    await this.paymentService.handleNotify(id, data);
    return { success: true };
  }

  @Get('networks')
  @ApiOperation({ summary: 'Get list of supported payment networks' })
  @ApiResponse({ status: 200, description: 'Networks retrieved successfully' })
  @Header('Cache-Control', 'public, max-age=3600')
  getNetworks() {
    this.logger.log('Fetching supported networks');
    return this.paymentService.getNetworks();
  }

  @Get('exchange-rates')
  @ApiOperation({ summary: 'Get current exchange rates' })
  @ApiResponse({
    status: 200,
    description: 'Exchange rates retrieved successfully',
  })
  @Header('Cache-Control', 'public, max-age=60')
  getExchangeRates() {
    this.logger.log('Fetching exchange rates');
    return this.paymentService.getExchangeRates();
  }
}
