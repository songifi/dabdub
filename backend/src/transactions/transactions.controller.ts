import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TransactionService } from './transactions.service';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import {
  PaginatedTransactionsDto,
  TransactionResponseDto,
} from './dto/transaction-response.dto';
import { Request } from 'express';

@Controller({ path: 'transactions', version: '1' })
@UseGuards(JwtAuthGuard)
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  /**
   * GET /transactions
   * Cursor-based pagination with filters (type array, status, dateFrom, dateTo)
   * Returns 20 items per page + nextCursor
   */
  @Get()
  async getTransactions(
    @Query() query: QueryTransactionsDto,
    @Req() req: Request,
  ): Promise<PaginatedTransactionsDto> {
    const userId = (req as any).user?.id;
    return this.transactionService.findByUserId(userId, query);
  }

  /**
   * GET /transactions/:id
   * Verify transaction.userId === req.user.id
   */
  @Get(':id')
  async getTransaction(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<TransactionResponseDto> {
    const userId = (req as any).user?.id;
    return this.transactionService.findById(id, userId);
  }
}
