import {
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual, SelectQueryBuilder } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Transaction } from './entities/transaction.entity';
import { TransactionStatusHistory } from './entities/transaction-status-history.entity';
import { TransactionQueryDto, ListTransactionsQueryDto } from './dto/transaction-query.dto';
import { TransactionDetailResponseDto } from './dto/transaction-detail.dto';
import {
  ListTransactionsResponseDto,
  TransactionAggregatesDto,
  TransactionExportJobResponseDto,
} from './dto/transaction-list-response.dto';
import { Settlement } from '../settlement/entities/settlement.entity';
import { WebhookDeliveryLogEntity } from '../database/entities/webhook-delivery-log.entity';
import { TRANSACTION_EXPORT_QUEUE, TransactionExportJobPayload } from './transaction-export.processor';
import { randomUUID } from 'crypto';
import * as puppeteer from 'puppeteer';
import { Readable } from 'stream';

/** Maps known chain identifiers to their block explorer base URLs */
const EXPLORER_BASE_URLS: Record<string, string> = {
  base: 'https://basescan.org/tx',
  ethereum: 'https://etherscan.io/tx',
  eth: 'https://etherscan.io/tx',
  polygon: 'https://polygonscan.com/tx',
  matic: 'https://polygonscan.com/tx',
  stellar: 'https://stellar.expert/explorer/public/tx',
  stacks: 'https://explorer.hiro.so/txid',
  bsc: 'https://bscscan.com/tx',
  arbitrum: 'https://arbiscan.io/tx',
  optimism: 'https://optimistic.etherscan.io/tx',
};

function buildExplorerUrl(chain: string, txHash: string): string | undefined {
  const base = EXPLORER_BASE_URLS[chain?.toLowerCase()];
  if (!base) return undefined;
  return `${base}/${txHash}`;
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(TransactionStatusHistory)
    private statusHistoryRepository: Repository<TransactionStatusHistory>,
    @InjectRepository(Settlement)
    private settlementRepository: Repository<Settlement>,
    @InjectRepository(WebhookDeliveryLogEntity)
    private webhookLogRepository: Repository<WebhookDeliveryLogEntity>,
    @InjectQueue(TRANSACTION_EXPORT_QUEUE)
    private exportQueue: Queue<TransactionExportJobPayload>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) { }

  async findAll(query: TransactionQueryDto) {
    const {
      network,
      status,
      startDate,
      endDate,
      minAmount,
      page,
      limit,
      sortBy,
      sortOrder,
    } = query;

    const where: any = { isSandbox: false };

    if (network) {
      where.network = network;
    }

    if (status) {
      where.status = status;
    }

    if (startDate && endDate) {
      where.createdAt = Between(new Date(startDate), new Date(endDate));
    } else if (startDate) {
      where.createdAt = MoreThanOrEqual(new Date(startDate));
    } else if (endDate) {
      where.createdAt = LessThanOrEqual(new Date(endDate));
    }

    if (minAmount) {
      where.amount = MoreThanOrEqual(minAmount);
    }

    const [items, total] = await this.transactionRepository.findAndCount({
      where,
      order: {
        [sortBy]: sortOrder,
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items,
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }

  /**
   * High-performance transaction list with filtering, aggregates, and cursor pagination
   */
  async listTransactions(
    query: ListTransactionsQueryDto,
  ): Promise<ListTransactionsResponseDto | TransactionExportJobResponseDto> {
    // Handle export trigger
    if (query.export) {
      return this.triggerExport(query);
    }

    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'DESC';

    // Build query
    const qb = this.buildFilteredQuery(query);

    // Determine pagination strategy
    const useCursorPagination = query.cursor !== undefined;

    if (useCursorPagination && query.cursor) {
      // Cursor-based pagination for large datasets
      const cursorData = this.decodeCursor(query.cursor);
      qb.andWhere(`t.${sortBy} ${sortOrder === 'DESC' ? '<' : '>'} :cursorValue`, {
        cursorValue: cursorData.value,
      });
      qb.andWhere('t.id != :cursorId', { cursorId: cursorData.id });
    } else {
      // Offset-based pagination
      qb.skip((page - 1) * limit);
    }

    qb.take(limit + 1); // Fetch one extra to determine if there's a next page

    // Execute query
    const transactions = await qb.getMany();
    const hasMore = transactions.length > limit;
    if (hasMore) {
      transactions.pop(); // Remove the extra record
    }

    // Get total count (with caching for performance)
    const total = await this.getCachedCount(query);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    let nextCursor: string | undefined;

    if (hasMore && transactions.length > 0) {
      const lastItem = transactions[transactions.length - 1];
      nextCursor = this.encodeCursor({
        value: (lastItem as any)[sortBy],
        id: lastItem.id,
      });
    }

    // Get aggregates (cached)
    const aggregates = await this.getAggregates(query);

    return {
      data: transactions,
      meta: {
        total,
        page,
        limit,
        totalPages,
        nextCursor,
      },
      aggregates,
    };
  }

  /**
   * Build filtered query with all filter conditions
   */
  private buildFilteredQuery(filters: ListTransactionsQueryDto): SelectQueryBuilder<Transaction> {
    const qb = this.transactionRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.paymentRequest', 'pr')
      .andWhere('t.isSandbox = :isSandbox', { isSandbox: false });

    // Exact hash match (highest priority)
    if (filters.txHash) {
      qb.andWhere('t.txHash = :txHash', { txHash: filters.txHash });
      return qb; // Return early for exact match
    }

    // Apply filters
    if (filters.merchantId) {
      qb.andWhere('pr.merchantId = :merchantId', { merchantId: filters.merchantId });
    }

    if (filters.status) {
      qb.andWhere('t.status = :status', { status: filters.status });
    }

    if (filters.chain) {
      qb.andWhere('t.network = :chain', { chain: filters.chain });
    }

    if (filters.tokenSymbol) {
      qb.andWhere('t.tokenSymbol = :tokenSymbol', { tokenSymbol: filters.tokenSymbol });
    }

    if (filters.minAmountUsd) {
      qb.andWhere('CAST(t.usdValue AS DECIMAL) >= :minAmount', {
        minAmount: parseFloat(filters.minAmountUsd),
      });
    }

    if (filters.maxAmountUsd) {
      qb.andWhere('CAST(t.usdValue AS DECIMAL) <= :maxAmount', {
        maxAmount: parseFloat(filters.maxAmountUsd),
      });
    }

    if (filters.createdAfter) {
      qb.andWhere('t.createdAt >= :createdAfter', { createdAfter: new Date(filters.createdAfter) });
    }

    if (filters.createdBefore) {
      qb.andWhere('t.createdAt <= :createdBefore', { createdBefore: new Date(filters.createdBefore) });
    }

    if (filters.flaggedOnly) {
      qb.andWhere('t.flaggedForReview = :flagged', { flagged: true });
    }

    // Order by
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'DESC';
    qb.orderBy(`t.${sortBy}`, sortOrder);
    qb.addOrderBy('t.id', sortOrder); // Secondary sort for stable pagination

    return qb;
  }

  /**
   * Get cached count for performance
   */
  private async getCachedCount(filters: ListTransactionsQueryDto): Promise<number> {
    const cacheKey = `tx:count:${JSON.stringify(filters)}`;
    const cached = await this.cacheManager.get<number>(cacheKey);
    
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const qb = this.buildFilteredQuery(filters);
    const count = await qb.getCount();

    // Cache for 15 seconds
    await this.cacheManager.set(cacheKey, count, 15000);
    return count;
  }

  /**
   * Get aggregate statistics with caching
   */
  private async getAggregates(filters: ListTransactionsQueryDto): Promise<TransactionAggregatesDto> {
    const cacheKey = `tx:aggregates:${JSON.stringify(filters)}`;
    const cached = await this.cacheManager.get<TransactionAggregatesDto>(cacheKey);

    if (cached) {
      return cached;
    }

    const qb = this.buildFilteredQuery(filters);

    // Get aggregates in a single query
    const result = await qb
      .select('SUM(CAST(t.usdValue AS DECIMAL))', 'totalVolumeUsd')
      .addSelect('SUM(CAST(t.feeCollectedUsd AS DECIMAL))', 'totalFeesUsd')
      .addSelect('t.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('t.status')
      .getRawMany();

    const totalVolumeUsd = result.reduce((sum, r) => sum + parseFloat(r.totalVolumeUsd || '0'), 0);
    const totalFeesUsd = result.reduce((sum, r) => sum + parseFloat(r.totalFeesUsd || '0'), 0);
    const countByStatus: Record<string, number> = {};

    result.forEach((r) => {
      countByStatus[r.status] = parseInt(r.count, 10);
    });

    const aggregates: TransactionAggregatesDto = {
      totalVolumeUsd: totalVolumeUsd.toFixed(2),
      totalFeesUsd: totalFeesUsd.toFixed(2),
      countByStatus,
    };

    // Cache for 15 seconds
    await this.cacheManager.set(cacheKey, aggregates, 15000);
    return aggregates;
  }

  /**
   * Trigger async export job
   */
  private async triggerExport(filters: ListTransactionsQueryDto): Promise<TransactionExportJobResponseDto> {
    const jobId = randomUUID();
    
    // Get estimated count
    const estimatedRecords = await this.getCachedCount(filters);

    // Enqueue export job
    await this.exportQueue.add('generate', {
      jobId,
      filters,
    } as TransactionExportJobPayload);

    return {
      jobId,
      estimatedRecords,
    };
  }

  /**
   * Encode cursor for pagination
   */
  private encodeCursor(data: { value: any; id: string }): string {
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  /**
   * Decode cursor for pagination
   */
  private decodeCursor(cursor: string): { value: any; id: string } {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
  }

  async findOne(id: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id },
    });
    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }
    return transaction;
  }

  async getDetail(id: string): Promise<TransactionDetailResponseDto> {
    const cacheKey = `cache:transaction:${id}`;
    const cached = await this.cacheManager.get<TransactionDetailResponseDto>(cacheKey);
    if (cached) return cached;

    // Fetch transaction with merchant relation via paymentRequest
    const tx = await this.transactionRepository.findOne({
      where: { id },
      relations: ['paymentRequest', 'paymentRequest.merchant'],
    });
    if (!tx) throw new NotFoundException(`Transaction with ID ${id} not found`);

    const paymentRequest = tx.paymentRequest;
    const merchant = paymentRequest?.merchant;

    // Parallel fetch: status history, settlement, webhooks
    const [statusHistory, settlement, webhooks] = await Promise.all([
      this.statusHistoryRepository.find({
        where: { transactionId: id },
        order: { at: 'ASC' },
      }),
      paymentRequest
        ? this.settlementRepository.findOne({ where: { paymentRequestId: paymentRequest.id } })
        : Promise.resolve(null),
      paymentRequest
        ? this.webhookLogRepository.find({
          where: { paymentRequestId: paymentRequest.id },
          order: { createdAt: 'ASC' },
        })
        : Promise.resolve([]),
    ]);

    // If no status history rows exist yet, fall back to paymentRequest.statusHistory
    const statusHistoryItems =
      statusHistory.length > 0
        ? statusHistory.map((h) => ({ status: h.status, at: h.at, reason: h.reason }))
        : (paymentRequest?.statusHistory ?? []).map((h) => ({
          status: h.status,
          at: new Date(h.timestamp),
          reason: h.reason,
        }));

    // --- On-chain block ---
    const usdAmount = tx.usdValue != null ? String(tx.usdValue) : tx.fiatAmount != null ? String(tx.fiatAmount) : '0.00';
    const networkFeeUsd = tx.networkFeeUsd != null ? String(tx.networkFeeUsd) : '0.000';
    const exchangeRate = tx.exchangeRate != null ? String(tx.exchangeRate) : '1.0000';

    const onChain = {
      txHash: tx.txHash,
      chain: tx.network,
      blockNumber: tx.blockNumber,
      confirmations: tx.confirmations,
      tokenAddress: tx.tokenAddress,
      tokenSymbol: tx.tokenSymbol,
      tokenAmount: tx.cryptoAmount,
      fromAddress: tx.fromAddress,
      toAddress: tx.toAddress,
      gasUsed: tx.gasUsed,
      gasPriceGwei: tx.gasPriceGwei,
      networkFeeEth: tx.networkFeeEth,
      networkFeeUsd,
      explorerUrl: buildExplorerUrl(tx.network, tx.txHash),
    };

    // --- Valuation block ---
    const valuation = {
      usdAmount,
      exchangeRate,
      valuedAt: tx.valuedAt ?? tx.confirmedAt ?? tx.blockTimestamp,
    };

    // --- Fee breakdown ---
    const feeStructure = (merchant as any)?.feeStructure;
    const platformFeePercentage = feeStructure?.transactionFeePercentage ?? '1.50';
    const platformFeeFlat = feeStructure?.transactionFeeFlat ?? '0.30';

    const usdNum = parseFloat(usdAmount) || 0;
    const netFeeNum = parseFloat(networkFeeUsd) || 0;
    const pctFeeNum = (parseFloat(platformFeePercentage) / 100) * usdNum;
    const flatFeeNum = parseFloat(platformFeeFlat) || 0;
    const platformFeeUsd = (pctFeeNum + flatFeeNum).toFixed(3);
    const totalFeeUsd = (pctFeeNum + flatFeeNum + netFeeNum).toFixed(3);
    const merchantPayoutUsd = (usdNum - parseFloat(totalFeeUsd)).toFixed(3);

    const fees = {
      platformFeePercentage,
      platformFeeFlat,
      platformFeeUsd,
      networkFeeUsd,
      totalFeeUsd,
      merchantPayoutUsd,
    };

    // --- Settlement block ---
    const settlementDto = settlement
      ? {
        id: settlement.id,
        batchId: settlement.batchId,
        fiatAmount: String(settlement.netAmount ?? settlement.amount),
        currency: settlement.currency,
        exchangeRateUsed: String(settlement.exchangeRate ?? '1.0000'),
        settledAt: settlement.settledAt,
        bankTransferReference: settlement.settlementReference ?? settlement.providerReference,
      }
      : undefined;

    // --- Webhooks block ---
    const webhookDtos = (webhooks as WebhookDeliveryLogEntity[]).map((w) => ({
      id: w.id,
      event: w.event,
      deliveredAt: w.deliveredAt,
      statusCode: w.httpStatusCode,
      responseTimeMs: w.responseTimeMs,
      attempts: w.attemptNumber,
    }));

    const result: TransactionDetailResponseDto = {
      id: tx.id,
      merchant: merchant
        ? {
          id: merchant.id,
          businessName: (merchant as any).businessName ?? merchant.name,
          email: merchant.email,
        }
        : { id: paymentRequest?.merchantId ?? '', businessName: '', email: '' },
      onChain,
      valuation,
      fees,
      status: tx.status,
      statusHistory: statusHistoryItems,
      settlement: settlementDto,
      webhooks: webhookDtos,
      adminActions: [],
      metadata: paymentRequest?.metadata,
      failureReason: tx.failureReason ?? tx.errorMessage,
      confirmedAt: tx.confirmedAt,
      settledAt: tx.settledAt ?? settlement?.settledAt,
      createdAt: tx.createdAt,
    };

    // Cache for 30 seconds
    await this.cacheManager.set(cacheKey, result, 30000);
    return result;
  }

  async findByHash(txHash: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { txHash },
    });
    if (!transaction) {
      throw new NotFoundException(`Transaction with hash ${txHash} not found`);
    }
    return transaction;
  }

  async getConfirmations(id: string): Promise<{ confirmations: number }> {
    const transaction = await this.findOne(id);
    return { confirmations: transaction.confirmations };
  }

  async export(
    query: TransactionQueryDto,
    format: 'csv' | 'pdf',
  ): Promise<Readable | Buffer> {
    const exportQuery = { ...query, page: 1, limit: 10000 };
    const { items } = await this.findAll(exportQuery);

    if (format === 'csv') {
      return this.generateCsv(items);
    } else {
      return this.generatePdf(items);
    }
  }

  private generateCsv(transactions: Transaction[]): Readable {
    const header = 'ID,Date,Network,Hash,From,To,Amount,Currency,Status\n';
    const rows = transactions
      .map(
        (t) =>
          `${t.id},${t.createdAt.toISOString()},${t.network},${t.txHash},${t.fromAddress},${t.toAddress},${t.amount},${t.currency},${t.status}`,
      )
      .join('\n');

    const stream = new Readable();
    stream.push(header + rows);
    stream.push(null);
    return stream;
  }

  private async generatePdf(transactions: Transaction[]): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox'],
    });
    const page = await browser.newPage();

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          h1 { text-align: center; }
        </style>
      </head>
      <body>
        <h1>Transaction Report</h1>
        <p>Generated on: ${new Date().toLocaleString()}</p>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Network</th>
              <th>Hash</th>
              <th>Amount</th>
              <th>Currency</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${transactions
        .map(
          (t) => `
              <tr>
                <td>${t.createdAt.toISOString()}</td>
                <td>${t.network}</td>
                <td>${t.txHash.substring(0, 10)}...</td>
                <td>${t.amount}</td>
                <td>${t.currency}</td>
                <td>${t.status}</td>
              </tr>
            `,
        )
        .join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    await page.setContent(htmlContent);
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();
    return Buffer.from(pdfBuffer);
  }
}
