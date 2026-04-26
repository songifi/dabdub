import { Controller, Post, Get, Param, Body, Query, UseGuards, Request, UseInterceptors, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { IdempotencyInterceptor } from '../payment/idempotency.interceptor';

@ApiTags('payments')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Create a payment request' })
  @ApiOkResponse({ description: 'Payment created' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  create(@Request() req: { user: { merchantId: string } }, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(req.user.merchantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all payments' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOkResponse({ description: 'Paginated payments' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  findAll(@Request() req: { user: { merchantId: string } }, @Query() pagination: PaginationDto) {
    return this.paymentsService.findAll(req.user.merchantId, pagination.page, pagination.limit);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Payment statistics' })
  @ApiOkResponse({ description: 'Aggregated stats' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  getStats(@Request() req: { user: { merchantId: string } }) {
    return this.paymentsService.getStats(req.user.merchantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  @ApiOkResponse({ description: 'Payment detail' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiNotFoundResponse({ description: 'Payment not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  findOne(@Request() req: { user: { merchantId: string } }, @Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.findOne(id, req.user.merchantId);
  }

  @Post(':id/refund')
  @ApiOperation({ summary: 'Initiate a refund for a settled payment' })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  @ApiOkResponse({ description: 'Refund successful' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiNotFoundResponse({ description: 'Payment not found' })
  @ApiBadRequestResponse({ description: 'Refund not possible' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  refund(
    @Request() req: { user: { merchantId: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefundPaymentDto,
  ) {
    return this.paymentsService.refund(id, req.user.merchantId, dto);
  }
}

@ApiTags('payments')
@Controller('pay')
export class PublicPaymentController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get(':reference')
  @ApiOperation({ summary: 'Get payment details by reference (public)' })
  @ApiParam({ name: 'reference', example: 'PAY-abc123' })
  @ApiOkResponse({ description: 'Public payment view' })
  @ApiNotFoundResponse({ description: 'Unknown reference' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  getByReference(@Param('reference') reference: string) {
    return this.paymentsService.findByReference(reference);
  }
}
