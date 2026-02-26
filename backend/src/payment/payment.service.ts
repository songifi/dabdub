import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from '../database/entities/payment.entity';
import { PlatformWallet } from '../treasury/entities/platform-wallet.entity';
import * as QRCode from 'qrcode';

import { PaymentMetrics } from './payment.metrics';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import {
  DEFAULT_EXPIRES_MINUTES,
  MAX_EXPIRES_MINUTES,
} from './dto/create-payment-request.dto';
import { PaymentRequestResponseDto } from './dto/payment-request-response.dto';
import { PaymentDetailsDto } from './dto/payment-details.dto';
import { PaymentListDto } from './dto/payment-list.dto';
import { PaymentFiltersDto } from './dto/payment-filters.dto';
import { PaymentReceiptDto } from './dto/payment-receipt.dto';
import { isSupportedChain } from './constants/supported-chains.constant';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';

const PLACEHOLDER_DEPOSIT_ADDRESS = '0x0000000000000000000000000000000000000000';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(PlatformWallet)
    private readonly platformWalletRepository: Repository<PlatformWallet>,
    private readonly metrics: PaymentMetrics,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  async createPayment(
    createPaymentDto: CreatePaymentDto,
  ): Promise<PaymentDetailsDto> {
    // Check for duplicate idempotency key
    const existing = await this.paymentRepository.findOne({
      where: { reference: createPaymentDto.idempotencyKey },
    });

    if (existing) {
      throw new ConflictException(
        'Payment with this idempotency key already exists',
      );
    }

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

  /**
   * Create a payment request: unique id, deposit address, USDC amount from fiat + live rate, qrPayload, expiresAt.
   * Exchange rate cached in Redis (TTL 60s). Idempotency via Idempotency-Key header.
   */
  async createPaymentRequest(
    dto: CreatePaymentRequestDto,
    idempotencyKey?: string,
  ): Promise<PaymentRequestResponseDto> {
    if (!isSupportedChain(dto.chain)) {
      throw new BadRequestException(
        `Unsupported chain. Supported: ${['polygon', 'base', 'celo', 'arbitrum', 'optimism'].join(', ')}`,
      );
    }

    const key = idempotencyKey?.trim();
    if (key) {
      const existing = await this.paymentRepository.findOne({
        where: { idempotencyKey: key },
      });
      if (existing && existing.depositAddress != null) {
        return this.toPaymentRequestResponse(existing);
      }
    }

    const expiresInMinutes =
      dto.expiresInMinutes ?? DEFAULT_EXPIRES_MINUTES;
    if (
      expiresInMinutes < 1 ||
      expiresInMinutes > MAX_EXPIRES_MINUTES
    ) {
      throw new BadRequestException(
        `expiresInMinutes must be between 1 and ${MAX_EXPIRES_MINUTES}`,
      );
    }

    const rate = await this.exchangeRateService.getFiatToUsdRate(
      dto.currency,
    );
    const usdcAmount = Number((dto.amount * rate).toFixed(8));

    const depositAddress = await this.getDepositAddressForChain(dto.chain);
    const expiresAt = new Date(
      Date.now() + expiresInMinutes * 60 * 1000,
    );

    const payment = this.paymentRepository.create({
      amount: dto.amount,
      currency: dto.currency,
      status: PaymentStatus.PENDING,
      network: dto.chain,
      depositAddress: depositAddress ?? PLACEHOLDER_DEPOSIT_ADDRESS,
      usdcAmount,
      expiresAt,
      idempotencyKey: key || undefined,
      metadata: dto.metadata ?? undefined,
    });

    const saved = await this.paymentRepository.save(payment);
    const qrPayload = this.buildQrPayload(
      saved.depositAddress!,
      saved.usdcAmount!,
      saved.network!,
    );
    return {
      paymentId: saved.id,
      depositAddress: saved.depositAddress!,
      usdcAmount: saved.usdcAmount!,
      qrPayload,
      expiresAt: saved.expiresAt!.toISOString(),
    };
  }

  private toPaymentRequestResponse(p: Payment): PaymentRequestResponseDto {
    const qrPayload = this.buildQrPayload(
      p.depositAddress ?? PLACEHOLDER_DEPOSIT_ADDRESS,
      p.usdcAmount ?? 0,
      p.network ?? '',
    );
    return {
      paymentId: p.id,
      depositAddress: p.depositAddress ?? PLACEHOLDER_DEPOSIT_ADDRESS,
      usdcAmount: Number(p.usdcAmount ?? 0),
      qrPayload,
      expiresAt: p.expiresAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  private buildQrPayload(
    address: string,
    usdcAmount: number,
    chain: string,
  ): string {
    return JSON.stringify({
      address,
      amount: String(usdcAmount),
      chain,
      token: 'USDC',
    });
  }

  private async getDepositAddressForChain(chain: string): Promise<string | null> {
    const wallet = await this.platformWalletRepository.findOne({
      where: { chain: chain.toLowerCase(), isActive: true },
    });
    return wallet?.walletAddress ?? null;
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
