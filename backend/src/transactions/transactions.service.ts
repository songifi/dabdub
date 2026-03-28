import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between } from 'typeorm';
import { Transaction, TransactionStatus } from './entities/transaction.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import {
  TransactionResponseDto,
  PaginatedTransactionsDto,
} from './dto/transaction-response.dto';

@Injectable()
export class TransactionService {
  private readonly PAGE_SIZE = 20;

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  /**
   * INSERT only — create a transaction. Called internally by payment modules.
   * Never UPDATE or DELETE on this table.
   */
  async create(dto: CreateTransactionDto): Promise<TransactionResponseDto> {
    const transaction = this.transactionRepository.create({
      userId: dto.userId,
      type: dto.type,
      amount: dto.amount,
      fee: dto.fee,
      balanceAfter: dto.balanceAfter,
      status: dto.status || TransactionStatus.PENDING,
      reference: dto.reference,
      counterpartyUsername: dto.counterpartyUsername,
      note: dto.note,
      metadata: dto.metadata || {},
    });

    const saved = await this.transactionRepository.save(transaction);
    return TransactionResponseDto.fromEntity(saved);
  }

  /**
   * Find by ID and verify userId matches
   */
  async findById(id: string, userId: string): Promise<TransactionResponseDto> {
    const transaction = await this.transactionRepository.findOne({
      where: { id, userId },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }

    return TransactionResponseDto.fromEntity(transaction);
  }

  /**
   * Cursor-based pagination using createdAt
   * Returns 20 items per page + nextCursor
   */
  async findByUserId(
    userId: string,
    query: QueryTransactionsDto,
  ): Promise<PaginatedTransactionsDto> {
    // Build where conditions
    const where: { userId: string; type?: any; status?: any; createdAt?: any } =
      { userId };

    // Filter by type array
    if (query.types && query.types.length > 0) {
      where.type = In(query.types);
    }

    // Filter by status
    if (query.status) {
      where.status = query.status;
    }

    // Filter by date range
    if (query.dateFrom || query.dateTo) {
      const dateFilter: { $gte?: Date; $lte?: Date } = {};
      if (query.dateFrom) {
        dateFilter.$gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        dateFilter.$lte = new Date(query.dateTo);
      }
      where.createdAt = dateFilter;
    }

    // Handle cursor-based pagination
    if (query.cursor) {
      try {
        const decodedCursor = Buffer.from(query.cursor, 'base64').toString(
          'utf-8',
        );
        const cursorDate = new Date(decodedCursor);
        where.createdAt = Between(
          query.dateFrom ? new Date(query.dateFrom) : new Date('1970-01-01'),
          cursorDate,
        );
      } catch {
        throw new BadRequestException('Invalid cursor');
      }
    }

    // Fetch PAGE_SIZE + 1 to determine if there's a next page
    const transactions = await this.transactionRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: this.PAGE_SIZE + 1,
    });

    let nextCursor: string | undefined;
    const items = transactions.slice(0, this.PAGE_SIZE);

    // If we got more than PAGE_SIZE, encode the cursor from the last item
    if (transactions.length > this.PAGE_SIZE) {
      const lastItem = items[items.length - 1];
      nextCursor = Buffer.from(lastItem.createdAt.toISOString()).toString(
        'base64',
      );
    }

    return {
      items: items.map((t) => TransactionResponseDto.fromEntity(t)),
      nextCursor,
    };
  }
}
