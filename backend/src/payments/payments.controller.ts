import { Controller, Post, Get, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a payment request' })
  create(@Request() req, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(req.user.merchantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all payments' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(@Request() req, @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.paymentsService.findAll(req.user.merchantId, +page, +limit);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Payment statistics' })
  getStats(@Request() req) {
    return this.paymentsService.getStats(req.user.merchantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment by ID' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.paymentsService.findOne(id, req.user.merchantId);
  }
}

@ApiTags('payments')
@Controller('pay')
export class PublicPaymentController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get(':reference')
  @ApiOperation({ summary: 'Get payment details by reference (public)' })
  getByReference(@Param('reference') reference: string) {
    return this.paymentsService.findByReference(reference);
  }
}
