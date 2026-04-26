import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { AmlFlag, AmlFlagReason, AmlFlagStatus } from './entities/aml-flag.entity';
import { Payment } from '../payments/entities/payment.entity';
import { NotificationsService } from '../notifications/notifications.service';

const HIGH_VALUE_THRESHOLD_USD = 10_000;
const HIGH_VELOCITY_LIMIT = 50;

@Injectable()
export class AmlService {
  private readonly logger = new Logger(AmlService.name);

  constructor(
    @InjectRepository(AmlFlag)
    private amlRepo: Repository<AmlFlag>,
    @InjectRepository(Payment)
    private paymentsRepo: Repository<Payment>,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  async checkAndFlag(payment: Payment): Promise<void> {
    if (Number(payment.amountUsd) >= HIGH_VALUE_THRESHOLD_USD) {
      await this.createFlag(payment.merchantId, payment.id, AmlFlagReason.HIGH_VALUE, {
        amountUsd: payment.amountUsd,
      });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const dailyCount = await this.paymentsRepo.count({
      where: { merchantId: payment.merchantId, createdAt: MoreThanOrEqual(startOfDay) },
    });

    if (dailyCount > HIGH_VELOCITY_LIMIT) {
      await this.createFlag(payment.merchantId, payment.id, AmlFlagReason.HIGH_VELOCITY, {
        dailyCount,
      });
    }
  }

  private async createFlag(
    merchantId: string,
    paymentId: string,
    reason: AmlFlagReason,
    metadata: Record<string, any>,
  ): Promise<void> {
    const flag = this.amlRepo.create({ merchantId, paymentId, reason, metadata });
    await this.amlRepo.save(flag);
    this.logger.warn(`AML flag created: ${reason} for merchant ${merchantId}`);

    const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
    if (adminEmail) {
      await this.notificationsService.enqueueEmail({
        recipient: adminEmail,
        subject: `[AML Alert] New flag: ${reason}`,
        text: `A new AML flag has been raised.\n\nReason: ${reason}\nMerchant ID: ${merchantId}\nPayment ID: ${paymentId}\nDetails: ${JSON.stringify(metadata, null, 2)}\n\nPlease review at /admin/aml.`,
      });
    }
  }

  async findAll(page = 1, limit = 20) {
    const [flags, total] = await this.amlRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { flags, total, page, limit };
  }

  async findPending(page = 1, limit = 20) {
    const [flags, total] = await this.amlRepo.findAndCount({
      where: { status: AmlFlagStatus.PENDING },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { flags, total, page, limit };
  }

  async review(id: string, status: AmlFlagStatus, reviewedBy: string, note?: string): Promise<AmlFlag> {
    const flag = await this.amlRepo.findOne({ where: { id } });
    if (!flag) throw new NotFoundException(`AML flag ${id} not found`);

    flag.status = status;
    flag.reviewedBy = reviewedBy;
    flag.reviewedAt = new Date();
    flag.reviewNote = note ?? null;
    return this.amlRepo.save(flag);
  }

  async findByMerchant(merchantId: string) {
    return this.amlRepo.find({ where: { merchantId }, order: { createdAt: 'DESC' } });
  }
}
