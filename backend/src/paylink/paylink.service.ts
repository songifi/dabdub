import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { customAlphabet } from 'nanoid';
import { EmailService } from '../email/email.service';
import { Merchant } from '../merchants/entities/merchant.entity';
import { NotificationService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notifications.types';
import { SorobanService } from '../soroban/soroban.service';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../transactions/entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import { CheeseGateway, WS_EVENTS } from '../ws/cheese.gateway';
import { CreatePayLinkDto } from './dto/create-pay-link.dto';
import { ListPayLinksQueryDto } from './dto/list-pay-links-query.dto';
import { PayLinkPublicDto } from './dto/pay-link-public.dto';
import { PayLink, PayLinkStatus } from './entities/pay-link.entity';

const DEFAULT_EXPIRES_HOURS = 72;
const PAYLINK_TOKEN_SIZE = 10;
const nanoid10 = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  PAYLINK_TOKEN_SIZE,
);

type TxHashCandidate = {
  txHash?: string;
  hash?: string;
  transactionHash?: string;
};

@Injectable()
export class PayLinkService {
  constructor(
    @InjectRepository(PayLink)
    private readonly payLinkRepo: Repository<PayLink>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Merchant)
    private readonly merchantRepo: Repository<Merchant>,

    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,

    private readonly sorobanService: SorobanService,
    private readonly gateway: CheeseGateway,
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
  ) {}

  async countActiveReceiveLinks(creatorUserId: string): Promise<number> {
    return this.payLinkRepo
      .createQueryBuilder('p')
      .where('p.creatorUserId = :creatorUserId', { creatorUserId })
      .andWhere('p.status = :status', { status: PayLinkStatus.ACTIVE })
      .andWhere('p.expiresAt > :now', { now: new Date() })
      .getCount();
  }

  async create(creator: User, dto: CreatePayLinkDto): Promise<PayLink> {
    if (dto.customSlug) {
      const existing = await this.payLinkRepo.findOne({
        where: { tokenId: dto.customSlug },
      });
      if (existing) {
        throw new ConflictException('PayLink slug already exists');
      }
    }

    const tokenId = dto.customSlug ?? (await this.generateUniqueTokenId());
    const expiresInHours = dto.expiresInHours ?? DEFAULT_EXPIRES_HOURS;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const sorobanResult = await this.sorobanService.createPayLink(
      creator.username,
      tokenId,
      dto.amount,
      dto.note ?? '',
    );

    const createdTxHash = this.extractTxHash(sorobanResult);

    const entity = this.payLinkRepo.create({
      creatorUserId: creator.id,
      tokenId,
      amount: dto.amount,
      note: dto.note ?? null,
      status: PayLinkStatus.ACTIVE,
      paidByUserId: null,
      expiresAt,
      createdTxHash,
      paymentTxHash: null,
    });

    return this.payLinkRepo.save(entity);
  }

  async getPublic(tokenId: string): Promise<PayLinkPublicDto> {
    const payLink = await this.payLinkRepo.findOne({ where: { tokenId } });
    if (!payLink) {
      throw new NotFoundException('PayLink not found');
    }

    await this.ensureNotExpired(payLink);

    const creator = await this.userRepo.findOne({
      where: { id: payLink.creatorUserId },
    });
    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    const merchant = await this.merchantRepo.findOne({
      where: { userId: creator.id },
    });

    return {
      creatorDisplayName: creator.displayName,
      businessName: merchant?.businessName ?? null,
      amount: payLink.amount,
      note: payLink.note,
      status: payLink.status,
      expiresAt: payLink.expiresAt,
    };
  }

  async pay(tokenId: string, payer: User): Promise<PayLink> {
    const payLink = await this.payLinkRepo.findOne({ where: { tokenId } });
    if (!payLink) {
      throw new NotFoundException('PayLink not found');
    }

    await this.ensureNotExpired(payLink);

    if (payLink.status === PayLinkStatus.PAID) {
      throw new ConflictException('PayLink already paid');
    }
    if (payLink.status === PayLinkStatus.CANCELLED) {
      throw new ConflictException('PayLink is cancelled');
    }

    const creator = await this.userRepo.findOne({
      where: { id: payLink.creatorUserId },
    });
    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    const sorobanResult = await this.sorobanService.payPayLink(
      payer.username,
      tokenId,
    );
    const paymentTxHash = this.extractTxHash(sorobanResult);

    payLink.status = PayLinkStatus.PAID;
    payLink.paidByUserId = payer.id;
    payLink.paymentTxHash = paymentTxHash;
    const saved = await this.payLinkRepo.save(payLink);

    await this.transactionRepo.save(
      this.transactionRepo.create({
        userId: payer.id,
        type: TransactionType.TRANSFER,
        amount: Number(payLink.amount),
        currency: 'USDC',
        status: TransactionStatus.COMPLETED,
        reference: tokenId,
        description: `PayLink payment to ${creator.username}`,
      }),
    );

    await this.transactionRepo.save(
      this.transactionRepo.create({
        userId: creator.id,
        type: TransactionType.TRANSFER,
        amount: Number(payLink.amount),
        currency: 'USDC',
        status: TransactionStatus.COMPLETED,
        reference: tokenId,
        description: `PayLink payment received from ${payer.username}`,
      }),
    );

    await this.gateway.emitToUser(creator.id, WS_EVENTS.PAYLINK_PAID, {
      tokenId,
      amount: payLink.amount,
      paidByUserId: payer.id,
      paidByUsername: payer.username,
      paymentTxHash,
    });

    await this.notificationService.create(
      creator.id,
      NotificationType.PAYLINK_PAID,
      'PayLink paid',
      `${payer.username} paid your PayLink ${tokenId}.`,
      {
        tokenId,
        amount: payLink.amount,
        paidByUserId: payer.id,
      },
    );

    await this.emailService.queue(
      creator.email,
      'paylink_paid',
      {
        creatorName: creator.displayName ?? creator.username,
        payerUsername: payer.username,
        amount: payLink.amount,
        tokenId,
      },
      creator.id,
    );

    return saved;
  }

  async cancel(tokenId: string, requester: User): Promise<PayLink> {
    const payLink = await this.payLinkRepo.findOne({ where: { tokenId } });
    if (!payLink) {
      throw new NotFoundException('PayLink not found');
    }

    await this.ensureNotExpired(payLink);

    if (payLink.creatorUserId !== requester.id) {
      throw new ForbiddenException('Only creator can cancel paylink');
    }

    if (payLink.status === PayLinkStatus.PAID) {
      throw new ConflictException('Cannot cancel a paid PayLink');
    }

    if (payLink.status === PayLinkStatus.CANCELLED) {
      return payLink;
    }

    await this.sorobanService.cancelPayLink(requester.username, tokenId);

    payLink.status = PayLinkStatus.CANCELLED;
    return this.payLinkRepo.save(payLink);
  }

  async listForCreator(
    creator: User,
    query: ListPayLinksQueryDto,
  ): Promise<{ items: PayLink[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.payLinkRepo
      .createQueryBuilder('p')
      .where('p.creator_user_id = :creatorUserId', {
        creatorUserId: creator.id,
      })
      .orderBy('p.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.status) {
      qb.andWhere('p.status = :status', { status: query.status });
    }

    const [items, total] = await qb.getManyAndCount();
    await this.expireInMemory(items);

    return { items, total, page, limit };
  }

  async markExpiredPayLinks(): Promise<number> {
    const result = await this.payLinkRepo
      .createQueryBuilder()
      .update(PayLink)
      .set({ status: PayLinkStatus.EXPIRED })
      .where('status = :active', { active: PayLinkStatus.ACTIVE })
      .andWhere('expires_at < NOW()')
      .execute();

    return result.affected ?? 0;
  }

  private async ensureNotExpired(payLink: PayLink): Promise<void> {
    if (
      payLink.status === PayLinkStatus.EXPIRED ||
      payLink.expiresAt.getTime() <= Date.now()
    ) {
      if (payLink.status !== PayLinkStatus.EXPIRED) {
        payLink.status = PayLinkStatus.EXPIRED;
        await this.payLinkRepo.save(payLink);
      }
      throw new GoneException('PayLink expired');
    }
  }

  private async expireInMemory(payLinks: PayLink[]): Promise<void> {
    const now = Date.now();
    const toExpire = payLinks.filter(
      (payLink) =>
        payLink.status === PayLinkStatus.ACTIVE &&
        payLink.expiresAt.getTime() <= now,
    );

    if (toExpire.length === 0) return;

    await this.payLinkRepo
      .createQueryBuilder()
      .update(PayLink)
      .set({ status: PayLinkStatus.EXPIRED })
      .whereInIds(toExpire.map((p) => p.id))
      .execute();

    for (const p of payLinks) {
      if (toExpire.some((e) => e.id === p.id)) {
        p.status = PayLinkStatus.EXPIRED;
      }
    }
  }

  private async generateUniqueTokenId(): Promise<string> {
    for (let i = 0; i < 5; i += 1) {
      const candidate = nanoid10();
      const existing = await this.payLinkRepo.findOne({
        where: { tokenId: candidate },
      });
      if (!existing) return candidate;
    }
    return `${nanoid10()}-${Date.now()}`.slice(0, 64);
  }

  private extractTxHash(result: unknown): string {
    if (typeof result === 'string') return result;
    if (result && typeof result === 'object') {
      const maybe = result as TxHashCandidate;
      return maybe.txHash ?? maybe.hash ?? maybe.transactionHash ?? 'unknown';
    }
    return 'unknown';
  }
}
