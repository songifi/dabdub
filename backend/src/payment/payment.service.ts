import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from '../database/entities/payment.entity';
import * as QRCode from 'qrcode';

import { PaymentMetrics } from './payment.metrics';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentDetailsDto } from './dto/payment-details.dto';
import { PaymentListDto } from './dto/payment-list.dto';
import { PaymentFiltersDto } from './dto/payment-filters.dto';
import { PaymentReceiptDto } from './dto/payment-receipt.dto';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly metrics: PaymentMetrics,
  ) {}

  async createPayment(
    createPaymentDto: CreatePaymentDto,
  ): Promise<PaymentDetailsDto> {
    const payment = this.paymentRepository.create({
      amount: createPaymentDto.amount,
      currency: createPaymentDto.currency,
      description: createPaymentDto.description,
      reference: createPaymentDto.reference || createPaymentDto.idempotencyKey,
      status: PaymentStatus.PENDING,
    });

    const saved = await this.paymentRepository.save(payment);
    return this.mapToDetailsDto(saved);
  }

  async getPayments(filters: PaymentFiltersDto): Promise<PaymentListDto> {
    const {
      page = 1,
      limit = 20,
      status,
      reference,
      fromDate,
      toDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const query = this.paymentRepository.createQueryBuilder('payment');

    if (status) {
      query.andWhere('payment.status = :status', { status });
    }

    if (reference) {
      query.andWhere('payment.reference LIKE :reference', {
        reference: `%${reference}%`,
      });
    }

    if (fromDate) {
      query.andWhere('payment.createdAt >= :fromDate', { fromDate });
    }

    if (toDate) {
      query.andWhere('payment.createdAt <= :toDate', { toDate });
    }

    query.orderBy(
      `payment.${sortBy}`,
      sortOrder.toUpperCase() as 'ASC' | 'DESC',
    );
    query.skip((page - 1) * limit).take(limit);

    const [payments, total] = await query.getManyAndCount();

    return {
      data: payments.map((p) => this.mapToDetailsDto(p)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPaymentById(id: string): Promise<PaymentDetailsDto> {
    const payment = await this.getPaymentDetails(id);
    return this.mapToDetailsDto(payment);
  }

  async getPaymentDetails(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({ where: { id } });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  async getPaymentStatus(id: string): Promise<{ status: PaymentStatus }> {
    const payment = await this.getPaymentDetails(id);
    return { status: payment.status };
  }

  async generateQrCode(
    id: string,
  ): Promise<{ qrCodeData: string; paymentUrl: string }> {
    const payment = await this.getPaymentDetails(id);
    const paymentUrl = `https://example.com/payment/${id}`;
    const qrCodeBuffer = await QRCode.toBuffer(paymentUrl);
    const qrCodeData = qrCodeBuffer.toString('base64');

    return {
      qrCodeData,
      paymentUrl,
    };
  }

  async cancelPayment(id: string, reason?: string): Promise<PaymentDetailsDto> {
    const payment = await this.getPaymentDetails(id);

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Only pending payments can be cancelled');
    }

    payment.status = PaymentStatus.CANCELLED;
    payment.description = reason
      ? `${payment.description || ''} - Cancelled: ${reason}`
      : payment.description;

    const updated = await this.paymentRepository.save(payment);
    return this.mapToDetailsDto(updated);
  }

  async getPaymentByReference(reference: string): Promise<PaymentDetailsDto> {
    const payment = await this.paymentRepository.findOne({
      where: { reference },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return this.mapToDetailsDto(payment);
  }

  async generateReceipt(id: string): Promise<PaymentReceiptDto> {
    const payment = await this.getPaymentDetails(id);

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException(
        'Receipt is only available for completed payments',
      );
    }

    return {
      id: payment.id,
      reference: payment.reference,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      description: payment.description,
      createdAt: payment.createdAt,
      completedAt: payment.updatedAt,
    };
  }

  async handleNotify(id: string, data: any): Promise<void> {
    const payment = await this.getPaymentDetails(id);
    if (data.status) {
      payment.status = data.status;
      await this.paymentRepository.save(payment);

      if (data.status === PaymentStatus.COMPLETED) {
        this.metrics.incrementPaymentProcessed(payment.currency || 'USD');
      } else if (data.status === PaymentStatus.FAILED) {
        this.metrics.incrementPaymentFailed(
          payment.currency || 'USD',
          data.reason || 'unknown',
        );
      }
    }
  }

  getNetworks(): string[] {
    return ['ethereum', 'polygon', 'bsc'];
  }

  getExchangeRates(): Record<string, number> {
    return {
      'ETH/USD': 3000,
      'MATIC/USD': 1.5,
      'BNB/USD': 400,
    };
  }

  private mapToDetailsDto(payment: Payment): PaymentDetailsDto {
    return {
      id: payment.id,
      reference: payment.reference,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      description: payment.description,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}
