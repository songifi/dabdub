import {
  BadRequestException,
  Injectable,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Repository } from 'typeorm';
import { Queue } from 'bull';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import { BulkPayment, BulkPaymentStatus } from './entities/bulk-payment.entity';
import { BulkPaymentRow, BulkPaymentRowStatus } from './entities/bulk-payment-row.entity';
import { BulkPaymentUploadDto } from './dto/bulk-payment-upload.dto';
import { BulkPaymentResponseDto, BulkPaymentValidationSummaryDto, BulkPaymentUploadResponseDto } from './dto/bulk-payment-response.dto';
import { BulkPaymentRowsQueryDto } from './dto/bulk-payment-rows-query.dto';
import { BulkPaymentRowResponseDto, BulkPaymentRowsResponseDto } from './dto/bulk-payment-row-response.dto';
import { R2Service } from '../r2/r2.service';
import { UsersService } from '../users/users.service';
import { BalanceService } from '../balance/balance.service';
import { PinService } from '../pin/pin.service';
import { TierService } from '../tier-config/tier.service';
import { TierName } from '../tier-config/entities/tier-config.entity';

export const BULK_PAYMENT_QUEUE = 'process-bulk-payment';
export const PROCESS_BULK_PAYMENT_JOB = 'process-bulk-payment';

export interface ProcessBulkPaymentJobData {
  bulkPaymentId: string;
}

interface ValidationResult {
  isValid: boolean;
  totalAmount: number;
  rows: Array<{
    username: string;
    amount: number;
    note?: string;
  }>;
  errors: string[];
}

@Injectable()
export class BulkPaymentService {
  private readonly logger = new Logger(BulkPaymentService.name);

  constructor(
    @InjectRepository(BulkPayment)
    private readonly bulkPaymentRepo: Repository<BulkPayment>,

    @InjectRepository(BulkPaymentRow)
    private readonly bulkPaymentRowRepo: Repository<BulkPaymentRow>,

    @InjectQueue(BULK_PAYMENT_QUEUE)
    private readonly bulkPaymentQueue: Queue,

    private readonly r2Service: R2Service,
    private readonly usersService: UsersService,
    private readonly balanceService: BalanceService,
    private readonly pinService: PinService,
    private readonly tierService: TierService,
  ) {}

  async upload(
    userId: string,
    csvBuffer: Buffer,
    dto: BulkPaymentUploadDto,
  ): Promise<BulkPaymentUploadResponseDto> {
    // Check tier access
    await this.checkTierAccess(userId);

    // Verify PIN
    await this.pinService.verifyPin(userId, dto.pin);

    // Parse and validate CSV
    const validation = await this.parseAndValidateCsv(csvBuffer);
    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'CSV validation failed',
        errors: validation.errors,
      });
    }

    // Check balance
    const balance = await this.balanceService.getBalance(userId);
    const totalAmount = parseFloat(validation.totalAmount.toFixed(2));
    const availableBalance = parseFloat(balance.totalUsdc);

    if (totalAmount > availableBalance) {
      throw new BadRequestException(
        `Insufficient balance. Required: ${totalAmount}, Available: ${availableBalance}`,
      );
    }

    // Upload CSV to R2
    const csvKey = `bulk-payments/${userId}/${randomUUID()}.csv`;
    await this.r2Service.uploadBuffer(csvKey, csvBuffer, 'text/csv');

    // Create BulkPayment record
    const bulkPayment = this.bulkPaymentRepo.create({
      initiatedBy: userId,
      label: dto.label,
      csvKey,
      totalRows: validation.rows.length,
      totalAmountUsdc: totalAmount.toFixed(2),
      status: BulkPaymentStatus.PENDING,
    });

    const savedBulkPayment = await this.bulkPaymentRepo.save(bulkPayment);

    // Create BulkPaymentRow records
    const rowEntities = validation.rows.map((row, index) =>
      this.bulkPaymentRowRepo.create({
        bulkPaymentId: savedBulkPayment.id,
        rowNumber: index + 1,
        toUsername: row.username,
        amountUsdc: row.amount.toFixed(2),
        note: row.note || null,
        status: BulkPaymentRowStatus.PENDING,
      }),
    );

    await this.bulkPaymentRowRepo.save(rowEntities);

    // Enqueue background job
    await this.bulkPaymentQueue.add(
      PROCESS_BULK_PAYMENT_JOB,
      { bulkPaymentId: savedBulkPayment.id } satisfies ProcessBulkPaymentJobData,
      { attempts: 1, removeOnComplete: true, removeOnFail: false },
    );

    return {
      bulkPayment: this.mapToResponseDto(savedBulkPayment),
      validation: {
        totalRows: validation.rows.length,
        validRows: validation.rows.length,
        invalidRows: 0,
        totalAmountUsdc: totalAmount.toFixed(2),
        errors: [],
      },
    };
  }

  async findAll(userId: string): Promise<BulkPaymentResponseDto[]> {
    const bulkPayments = await this.bulkPaymentRepo.find({
      where: { initiatedBy: userId },
      order: { createdAt: 'DESC' },
    });

    return bulkPayments.map(this.mapToResponseDto);
  }

  async findOne(userId: string, id: string): Promise<BulkPaymentResponseDto> {
    const bulkPayment = await this.bulkPaymentRepo.findOne({
      where: { id, initiatedBy: userId },
    });

    if (!bulkPayment) {
      throw new BadRequestException('Bulk payment not found');
    }

    return this.mapToResponseDto(bulkPayment);
  }

  async findRows(
    userId: string,
    bulkPaymentId: string,
    query: BulkPaymentRowsQueryDto,
  ): Promise<BulkPaymentRowsResponseDto> {
    // Verify ownership
    await this.findOne(userId, bulkPaymentId);

    const limit = Math.min(query.limit ?? 20, 100);
    const qb = this.bulkPaymentRowRepo
      .createQueryBuilder('row')
      .where('row.bulk_payment_id = :bulkPaymentId', { bulkPaymentId })
      .orderBy('row.rowNumber', 'ASC')
      .limit(limit + 1);

    if (query.status) {
      qb.andWhere('row.status = :status', { status: query.status });
    }

    if (query.cursor) {
      const cursorRow = await this.bulkPaymentRowRepo.findOne({
        where: { id: query.cursor },
      });
      if (cursorRow) {
        qb.andWhere('row.rowNumber > :cursorRowNumber', {
          cursorRowNumber: cursorRow.rowNumber,
        });
      }
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return {
      data: data.map(this.mapRowToResponseDto),
      nextCursor,
    };
  }

  async exportCsv(userId: string, bulkPaymentId: string): Promise<string> {
    // Verify ownership
    const bulkPayment = await this.bulkPaymentRepo.findOne({
      where: { id: bulkPaymentId, initiatedBy: userId },
    });

    if (!bulkPayment) {
      throw new BadRequestException('Bulk payment not found');
    }

    // Get all rows
    const rows = await this.bulkPaymentRowRepo.find({
      where: { bulkPaymentId },
      order: { rowNumber: 'ASC' },
    });

    // Generate CSV with additional columns
    const csvLines = ['username,amount_usdc,note,status,failure_reason'];
    for (const row of rows) {
      const line = [
        row.toUsername,
        row.amountUsdc,
        row.note || '',
        row.status,
        row.failureReason || '',
      ].map(field => `"${field.replace(/"/g, '""')}"`).join(',');
      csvLines.push(line);
    }

    return csvLines.join('\n');
  }

  private async parseAndValidateCsv(csvBuffer: Buffer): Promise<ValidationResult> {
    const rows: Array<{ username: string; amount: number; note?: string }> = [];
    const errors: string[] = [];

    const csvText = csvBuffer.toString('utf-8');
    const lines = csvText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    if (lines.length === 0) {
      errors.push('CSV file is empty');
      return { isValid: false, totalAmount: 0, rows: [], errors };
    }

    // Check header
    const header = lines[0].toLowerCase();
    if (!header.includes('username') || !header.includes('amount_usdc')) {
      errors.push('CSV must have "username" and "amount_usdc" columns');
      return { isValid: false, totalAmount: 0, rows: [], errors };
    }

    const dataLines = lines.slice(1);
    if (dataLines.length > 500) {
      errors.push('Maximum 500 rows allowed');
      return { isValid: false, totalAmount: 0, rows: [], errors };
    }

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      const rowNumber = i + 2; // +1 for 1-based, +1 for header

      // Simple CSV parsing (assuming no quoted fields with commas)
      const fields = line.split(',').map(field => field.trim());

      if (fields.length < 2) {
        errors.push(`Row ${rowNumber}: Invalid CSV format`);
        continue;
      }

      const [username, amountStr, ...noteParts] = fields;
      const note = noteParts.join(',').trim() || undefined;

      // Validate username
      if (!username || username.length === 0) {
        errors.push(`Row ${rowNumber}: Invalid username`);
        continue;
      }

      // Validate amount
      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) {
        errors.push(`Row ${rowNumber}: Invalid amount "${amountStr}"`);
        continue;
      }

      rows.push({
        username,
        amount,
        note,
      });
    }

    if (rows.length === 0) {
      errors.push('No valid rows found');
    }

    // Validate usernames exist
    const usernames = [...new Set(rows.map(r => r.username))];
    for (const username of usernames) {
      const user = await this.usersService.findByUsername(username);
      if (!user) {
        errors.push(`Username "${username}" not found`);
      }
    }

    const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);

    return {
      isValid: errors.length === 0,
      totalAmount,
      rows,
      errors,
    };
  }

  private async checkTierAccess(userId: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (user.tier === TierName.SILVER) {
      throw new ForbiddenException('Bulk payments require Gold or Black tier');
    }
  }

  private mapToResponseDto(bulkPayment: BulkPayment): BulkPaymentResponseDto {
    return {
      id: bulkPayment.id,
      label: bulkPayment.label,
      totalRows: bulkPayment.totalRows,
      successCount: bulkPayment.successCount,
      failureCount: bulkPayment.failureCount,
      totalAmountUsdc: bulkPayment.totalAmountUsdc,
      status: bulkPayment.status,
      createdAt: bulkPayment.createdAt,
      completedAt: bulkPayment.completedAt,
      progress: bulkPayment.totalRows > 0 ? bulkPayment.successCount / bulkPayment.totalRows : 0,
    };
  }

  private mapRowToResponseDto(row: BulkPaymentRow): BulkPaymentRowResponseDto {
    return {
      id: row.id,
      rowNumber: row.rowNumber,
      toUsername: row.toUsername,
      amountUsdc: row.amountUsdc,
      note: row.note,
      status: row.status,
      failureReason: row.failureReason,
      txId: row.txId,
      processedAt: row.processedAt,
    };
  }
}