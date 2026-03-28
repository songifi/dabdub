import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReceiptService } from './receipt.service';
import { User } from '../users/entities/user.entity';

type AuthReq = Request & { user: User };

@ApiTags('receipts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ version: '1' })
export class ReceiptController {
  constructor(private readonly receiptService: ReceiptService) {}

  @Get('transactions/:id/receipt')
  @ApiOperation({ summary: 'Get presigned receipt URL for a transaction' })
  @ApiQuery({ name: 'refresh', required: false, type: Boolean })
  getTransactionReceipt(
    @Param('id') id: string,
    @Req() req: AuthReq,
    @Query('refresh') refresh?: string,
  ) {
    return this.receiptService.generateTransactionReceipt(
      id,
      req.user.id,
      refresh === 'true',
    );
  }

  @Post('transactions/:id/receipt/email')
  @ApiOperation({ summary: 'Email receipt PDF to authenticated user' })
  emailTransactionReceipt(@Param('id') id: string, @Req() req: AuthReq) {
    return this.receiptService.emailTransactionReceipt(id, req.user.id);
  }

  @Get('paylinks/:tokenId/receipt')
  @ApiOperation({ summary: 'Get presigned receipt URL for a PayLink payment' })
  @ApiQuery({ name: 'refresh', required: false, type: Boolean })
  getPayLinkReceipt(
    @Param('tokenId') tokenId: string,
    @Req() req: AuthReq,
    @Query('refresh') refresh?: string,
  ) {
    return this.receiptService.generatePayLinkReceipt(
      tokenId,
      req.user.id,
      refresh === 'true',
    );
  }
}
