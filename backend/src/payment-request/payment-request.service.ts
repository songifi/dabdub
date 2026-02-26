import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Merchant } from '../database/entities/merchant.entity';
import { PaymentRequestRepository } from './repositories/payment-request.repository';
import { QrCodeService } from './services/qr-code.service';
import { StellarContractService } from './services/stellar-contract.service';
import { GlobalConfigService } from '../config/global-config.service';
import {
  PaymentRequest,
  PaymentRequestStatus,
} from '../database/entities/payment-request.entity';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { UpdatePaymentRequestDto } from './dto/update-payment-request.dto';
import {
  SearchPaymentRequestDto,
  StatsRangeDto,
} from './dto/search-payment-request.dto';
import {
  PaymentRequestNotFoundException,
  PaymentRequestInvalidStatusException,
  PaymentRequestAmountTooLowException,
  PaymentRequestAmountTooHighException,
  PaymentRequestCannotCancelException,
} from './exceptions/payment-request.exceptions';

/** Allowed status transitions */
const STATUS_TRANSITIONS: Record<PaymentRequestStatus, PaymentRequestStatus[]> =
  {
    [PaymentRequestStatus.PENDING]: [
      PaymentRequestStatus.PROCESSING,
      PaymentRequestStatus.CANCELLED,
      PaymentRequestStatus.EXPIRED,
    ],
    [PaymentRequestStatus.PROCESSING]: [
      PaymentRequestStatus.COMPLETED,
      PaymentRequestStatus.FAILED,
      PaymentRequestStatus.CANCELLED,
    ],
    [PaymentRequestStatus.COMPLETED]: [PaymentRequestStatus.REFUNDED],
    [PaymentRequestStatus.FAILED]: [],
    [PaymentRequestStatus.CANCELLED]: [],
    [PaymentRequestStatus.EXPIRED]: [],
    [PaymentRequestStatus.REFUNDED]: [],
  };

@Injectable()
export class PaymentRequestService {
  private readonly logger = new Logger(PaymentRequestService.name);

  constructor(
    private readonly repository: PaymentRequestRepository,
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
    private readonly qrCodeService: QrCodeService,
    private readonly stellarContractService: StellarContractService,
    private readonly configService: GlobalConfigService,
    private readonly expirationScheduler: ExpirationSchedulerService,
  ) {}

  async create(dto: CreatePaymentRequestDto): Promise<PaymentRequest> {
    const stellarConfig = this.configService.getStellarConfig();
    const { minAmount, maxAmount } = await this.getAmountLimits(dto.merchantId);

    if (dto.amount < minAmount) {
      throw new PaymentRequestAmountTooLowException(dto.amount, minAmount);
    }
    if (dto.amount > maxAmount) {
      throw new PaymentRequestAmountTooHighException(dto.amount, maxAmount);
    }

    // Idempotency: return existing record if key matches
    if (dto.idempotencyKey) {
      const existing = await this.repository.findByIdempotencyKey(
        dto.idempotencyKey,
      );
      if (existing) {
        this.logger.debug(
          `Returning existing payment request for idempotency key: ${dto.idempotencyKey}`,
        );
        return existing;
      }
    }

    // Calculate expiration
    const expiresAt = dto.expiresAt
      ? new Date(dto.expiresAt)
      : new Date(
          Date.now() + stellarConfig.defaultExpirationMinutes * 60 * 1000,
        );

    const network = dto.stellarNetwork || stellarConfig.activeNetwork;

    const statusHistory = [
      {
        status: PaymentRequestStatus.PENDING,
        timestamp: new Date().toISOString(),
      },
    ];

    const paymentRequest = await this.repository.create({
      merchantId: dto.merchantId,
      amount: dto.amount,
      currency: dto.currency || 'USDC',
      description: dto.description,
      stellarNetwork: network,
      customerName: dto.customerName,
      customerEmail: dto.customerEmail,
      customerPhone: dto.customerPhone,
      customerWalletAddress: dto.customerWalletAddress ?? null,
      customerId: dto.customerId ?? null,
      webhookUrl: dto.webhookUrl ?? null,
      expiresAt,
      idempotencyKey: dto.idempotencyKey,
      metadata: dto.metadata,
      statusHistory,
      status: PaymentRequestStatus.PENDING,
    });

    await this.expirationScheduler.scheduleExpiry(
      paymentRequest.id,
      expiresAt,
    );

    return paymentRequest;
  }

  async findById(id: string): Promise<PaymentRequest> {
    const request = await this.repository.findById(id);
    if (!request) {
      throw new PaymentRequestNotFoundException(id);
    }
    return request;
  }

  async update(
    id: string,
    dto: UpdatePaymentRequestDto,
  ): Promise<PaymentRequest> {
    const request = await this.findById(id);

    if (request.status !== PaymentRequestStatus.PENDING) {
      throw new PaymentRequestInvalidStatusException(request.status, 'update');
    }

    if (dto.amount !== undefined) {
      const { minAmount, maxAmount } = await this.getAmountLimits(
        request.merchantId,
      );
      if (dto.amount < minAmount) {
        throw new PaymentRequestAmountTooLowException(dto.amount, minAmount);
      }
      if (dto.amount > maxAmount) {
        throw new PaymentRequestAmountTooHighException(dto.amount, maxAmount);
      }
    }

    const updateData: Partial<PaymentRequest> = {};
    if (dto.amount !== undefined) updateData.amount = dto.amount;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.customerName !== undefined)
      updateData.customerName = dto.customerName;
    if (dto.customerEmail !== undefined)
      updateData.customerEmail = dto.customerEmail;
    if (dto.customerPhone !== undefined)
      updateData.customerPhone = dto.customerPhone;
    if (dto.customerWalletAddress !== undefined)
      updateData.customerWalletAddress = dto.customerWalletAddress;
    if (dto.customerId !== undefined) updateData.customerId = dto.customerId;
    if (dto.webhookUrl !== undefined) updateData.webhookUrl = dto.webhookUrl;
    if (dto.expiresAt !== undefined)
      updateData.expiresAt = new Date(dto.expiresAt);
    if (dto.metadata !== undefined) updateData.metadata = dto.metadata;

    return this.repository.update(id, updateData);
  }

  async cancel(id: string, reason?: string): Promise<PaymentRequest> {
    const request = await this.findById(id);

    if (
      request.status !== PaymentRequestStatus.PENDING &&
      request.status !== PaymentRequestStatus.PROCESSING
    ) {
      throw new PaymentRequestCannotCancelException(request.status);
    }

    const statusHistory = request.statusHistory || [];
    statusHistory.push({
      status: PaymentRequestStatus.CANCELLED,
      timestamp: new Date().toISOString(),
      reason,
    });

    return this.repository.update(id, {
      status: PaymentRequestStatus.CANCELLED,
      cancelledAt: new Date(),
      statusHistory,
    });
  }

  async process(id: string): Promise<PaymentRequest> {
    const request = await this.findById(id);
    this.validateTransition(request.status, PaymentRequestStatus.PROCESSING);

    const statusHistory = request.statusHistory || [];
    statusHistory.push({
      status: PaymentRequestStatus.PROCESSING,
      timestamp: new Date().toISOString(),
    });

    await this.expirationScheduler.cancelExpiry(id);

    return this.repository.update(id, {
      status: PaymentRequestStatus.PROCESSING,
      statusHistory,
    });
  }

  async refund(id: string, reason?: string): Promise<PaymentRequest> {
    const request = await this.findById(id);
    this.validateTransition(request.status, PaymentRequestStatus.REFUNDED);

    const statusHistory = request.statusHistory || [];
    statusHistory.push({
      status: PaymentRequestStatus.REFUNDED,
      timestamp: new Date().toISOString(),
      reason,
    });

    return this.repository.update(id, {
      status: PaymentRequestStatus.REFUNDED,
      statusHistory,
    });
  }

  async getQrCode(id: string): Promise<{ qrCode: string; uri: string }> {
    const request = await this.findById(id);

    const walletAddress = this.stellarContractService.getWalletAddress(
      request.stellarNetwork,
    );

    const uri = this.qrCodeService.buildSep0007Uri({
      destination: walletAddress,
      amount: Number(request.amount),
      memo: request.id,
      network: request.stellarNetwork,
    });

    const cachedData = request.qrCodeData;
    const cachedImage =
      cachedData &&
      typeof cachedData === 'object' &&
      'imageBase64' in cachedData
        ? (cachedData as { imageBase64?: string }).imageBase64
        : undefined;

    if (cachedImage) {
      return { qrCode: cachedImage, uri };
    }

    const qrCode = await this.qrCodeService.generateQrCode({
      destination: walletAddress,
      amount: Number(request.amount),
      memo: request.id,
      network: request.stellarNetwork,
    });

    await this.repository.update(id, {
      qrCodeData: { uri, format: 'sep0007', imageBase64: qrCode },
    });

    return { qrCode, uri };
  }

  async getStatus(
    id: string,
  ): Promise<{ status: PaymentRequestStatus; statusHistory: any[] }> {
    const request = await this.findById(id);
    return {
      status: request.status,
      statusHistory: request.statusHistory || [],
    };
  }

  async search(dto: SearchPaymentRequestDto): Promise<{
    data: PaymentRequest[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = parseInt(dto.page || '1', 10);
    const limit = parseInt(dto.limit || '20', 10);

    const [data, total] = await this.repository.search({
      merchantId: dto.merchantId,
      status: dto.status,
      customerEmail: dto.customerEmail,
      stellarNetwork: dto.stellarNetwork,
      fromDate: dto.fromDate ? new Date(dto.fromDate) : undefined,
      toDate: dto.toDate ? new Date(dto.toDate) : undefined,
      page,
      limit,
      sortBy: dto.sortBy || 'createdAt',
      sortOrder: dto.sortOrder || 'DESC',
    });

    return { data, total, page, limit };
  }

  async getStats(merchantId?: string) {
    return this.repository.getStats(merchantId);
  }

  async getStatsRange(dto: StatsRangeDto) {
    return this.repository.getStatsInRange(
      dto.merchantId,
      dto.fromDate ? new Date(dto.fromDate) : undefined,
      dto.toDate ? new Date(dto.toDate) : undefined,
    );
  }

  private async getAmountLimits(
    merchantId: string,
  ): Promise<{ minAmount: number; maxAmount: number }> {
    const stellarConfig = this.configService.getStellarConfig();
    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
      select: ['settings'],
    });

    const settings = merchant?.settings as
      | { paymentAmountMin?: number; paymentAmountMax?: number }
      | undefined;

    return {
      minAmount:
        settings?.paymentAmountMin ?? stellarConfig.minPaymentAmount,
      maxAmount:
        settings?.paymentAmountMax ?? stellarConfig.maxPaymentAmount,
    };
  }

  private validateTransition(
    current: PaymentRequestStatus,
    target: PaymentRequestStatus,
  ): void {
    const allowed = STATUS_TRANSITIONS[current];
    if (!allowed || !allowed.includes(target)) {
      throw new PaymentRequestInvalidStatusException(current, target);
    }
  }
}
