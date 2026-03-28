import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigType } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';

import { VirtualCard, CardStatus, CardBrand } from './entities/virtual-card.entity';
import { User } from '../users/entities/user.entity';
import { Transaction, TransactionType, TransactionStatus } from '../transactions/entities/transaction.entity';
import { TierName } from '../tier-config/entities/tier-config.entity';
import { sudoAfricaConfig } from '../config/sudo-africa.config';
import { SorobanService } from '../soroban/soroban.service';
import { RatesService } from '../rates/rates.service';
import {
  CreateVirtualCardDto,
  FundVirtualCardDto,
  VirtualCardResponseDto,
} from './dto/virtual-card.dto';

interface SudoCardResponse {
  id: string;
  last4: string;
  brand: 'visa' | 'mastercard';
  balance: string;
  spendingLimit?: string;
  status: string;
}

interface SudoWebhookPayload {
  eventType: string;
  cardId: string;
  transactionId: string;
  amount: number;
  merchant: string;
  timestamp: string;
  signature?: string;
}

@Injectable()
export class VirtualCardService {
  private readonly logger = new Logger(VirtualCardService.name);

  constructor(
    @InjectRepository(VirtualCard)
    private readonly cardRepo: Repository<VirtualCard>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,

    private readonly httpService: HttpService,

    @Inject(sudoAfricaConfig.KEY)
    private readonly sudoConfig: ConfigType<typeof sudoAfricaConfig>,

    private readonly sorobanService: SorobanService,
    private readonly ratesService: RatesService,
  ) {}

  /**
   * Create a new virtual card for a user.
   * Only Gold and Black tier users can create virtual cards.
   */
  async create(
    userId: string,
    dto: CreateVirtualCardDto,
  ): Promise<VirtualCardResponseDto> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Tier gate: only Gold and Black
    if (![TierName.GOLD, TierName.BLACK].includes(user.tier)) {
      throw new ForbiddenException({
        message: 'Upgrade to Gold or Black tier to create virtual cards',
        currentTier: user.tier,
        requiredTier: [TierName.GOLD, TierName.BLACK],
      });
    }

    // Call Sudo Africa API to create card
    const sudoCard = await this.createCardViaSudo(dto);

    // Create VirtualCard record
    const card = this.cardRepo.create({
      userId,
      sudoCardId: sudoCard.id,
      last4: sudoCard.last4,
      brand: sudoCard.brand.toLowerCase() as CardBrand,
      currency: 'USD',
      status: CardStatus.ACTIVE,
      spendingLimit: sudoCard.spendingLimit || null,
      balance: sudoCard.balance,
      billingAddress: {
        street: dto.billingAddress.street,
        city: dto.billingAddress.city,
        state: dto.billingAddress.state,
        country: dto.billingAddress.country,
        postalCode: dto.billingAddress.postalCode,
      },
    });

    const savedCard = await this.cardRepo.save(card);

    // Deduct card creation fee (typically $5 or similar - adjust as needed)
    // For now, we'll skip this and it can be added later
    // const creationFee = '5.00';
    // await this.deductFeeFromBalance(user, creationFee);

    // Log transaction for card creation
    // Note: We'll create this after deducting fee when fee logic is finalized
    // For now, just log the card creation
    this.logger.log(
      `Virtual card created for user ${userId}: ${sudoCard.brand} ending in ${sudoCard.last4}`,
    );

    return VirtualCardResponseDto.fromEntity(savedCard);
  }

  /**
   * Fund a virtual card from user's USDC balance.
   */
  async fund(
    cardId: string,
    dto: FundVirtualCardDto,
    userId: string,
  ): Promise<VirtualCardResponseDto> {
    const card = await this.cardRepo.findOne({
      where: { id: cardId, userId },
    });
    if (!card) throw new NotFoundException('Card not found');

    if (card.status !== CardStatus.ACTIVE) {
      throw new BadRequestException(
        `Cannot fund ${card.status} card`,
      );
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const amountUsd = parseFloat(dto.amountUsd);
    if (amountUsd <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    // For USD to USDC, we'll assume 1:1 for now
    // If there's a conversion needed, use the RatesService
    const amountUsdc = amountUsd.toString();

    // Deduct USDC from user balance via Soroban
    await this.sorobanService.transfer(
      user.username,
      'virtual_card_treasury', // Treasury account for virtual cards
      amountUsdc,
      `Fund virtual card ${card.id}`,
    );

    // Call Sudo Africa to fund the card
    await this.fundCardViaSudo(card.sudoCardId, amountUsd);

    // Update card balance
    const previousBalance = parseFloat(card.balance);
    const newBalance = (previousBalance + amountUsd).toString();
    card.balance = newBalance;
    await this.cardRepo.save(card);

    // Create transaction record
    const currentBalance = await this.getUserBalance(userId);
    await this.txRepo.save(
      this.txRepo.create({
        userId,
        type: TransactionType.VIRTUAL_CARD_FUND,
        amountUsdc,
        amount: amountUsd,
        currency: 'USDC',
        status: TransactionStatus.COMPLETED,
        reference: `fund_${card.id}`,
        description: `Funded virtual card ${card.last4} with ${amountUsd} USDC`,
        metadata: {
          cardId: card.id,
          sudoCardId: card.sudoCardId,
          brand: card.brand,
        },
        balanceAfter: currentBalance.toString(),
      }),
    );

    this.logger.log(
      `Virtual card ${card.id} funded with ${amountUsd} USDC`,
    );

    return VirtualCardResponseDto.fromEntity(card);
  }

  /**
   * Freeze a virtual card (toggle frozen status).
   */
  async freeze(cardId: string, userId: string): Promise<VirtualCardResponseDto> {
    const card = await this.cardRepo.findOne({
      where: { id: cardId, userId },
    });
    if (!card) throw new NotFoundException('Card not found');

    const targetStatus =
      card.status === CardStatus.FROZEN ? CardStatus.ACTIVE : CardStatus.FROZEN;

    // Call Sudo Africa to toggle freeze
    await this.freezeCardViaSudo(card.sudoCardId, targetStatus === CardStatus.FROZEN);

    card.status = targetStatus;
    await this.cardRepo.save(card);

    this.logger.log(
      `Virtual card ${card.id} status changed to ${targetStatus}`,
    );

    return VirtualCardResponseDto.fromEntity(card);
  }

  /**
   * Terminate a virtual card and refund remaining balance.
   */
  async terminate(cardId: string, userId: string): Promise<VirtualCardResponseDto> {
    const card = await this.cardRepo.findOne({
      where: { id: cardId, userId },
    });
    if (!card) throw new NotFoundException('Card not found');

    if (card.status === CardStatus.TERMINATED) {
      throw new BadRequestException('Card is already terminated');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Call Sudo Africa to terminate card
    await this.terminateCardViaSudo(card.sudoCardId);

    // Refund remaining balance to user USDC wallet
    const refundAmount = parseFloat(card.balance);
    if (refundAmount > 0) {
      await this.sorobanService.transfer(
        'virtual_card_treasury', // Treasury account for virtual cards
        user.username,
        refundAmount.toString(),
        `Refund from terminated virtual card ${card.id}`,
      );

      // Create refund transaction
      const currentBalance = await this.getUserBalance(userId);
      await this.txRepo.save(
        this.txRepo.create({
          userId,
          type: TransactionType.VIRTUAL_CARD_FUND, // Using FUND for now, could create REFUND type
          amountUsdc: refundAmount.toString(),
          amount: refundAmount,
          currency: 'USDC',
          status: TransactionStatus.COMPLETED,
          reference: `refund_${card.id}`,
          description: `Refunded ${refundAmount} USDC from terminated virtual card ${card.last4}`,
          metadata: {
            cardId: card.id,
            sudoCardId: card.sudoCardId,
          },
          balanceAfter: currentBalance.toString(),
        }),
      );
    }

    // Update card status
    card.status = CardStatus.TERMINATED;
    card.terminatedAt = new Date();
    card.balance = '0';
    await this.cardRepo.save(card);

    this.logger.log(
      `Virtual card ${card.id} terminated with refund of ${refundAmount} USDC`,
    );

    return VirtualCardResponseDto.fromEntity(card);
  }

  /**
   * Get a single card by ID.
   */
  async getCard(cardId: string, userId: string): Promise<VirtualCardResponseDto> {
    const card = await this.cardRepo.findOne({
      where: { id: cardId, userId },
    });
    if (!card) throw new NotFoundException('Card not found');

    return VirtualCardResponseDto.fromEntity(card);
  }

  /**
   * List all cards for a user.
   */
  async listCards(userId: string): Promise<VirtualCardResponseDto[]> {
    const cards = await this.cardRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return cards.map((c: VirtualCard) => VirtualCardResponseDto.fromEntity(c));
  }

  /**
   * Process Sudo Africa webhook for card transactions.
   */
  async handleSudoWebhook(
    payload: Buffer,
    signature: string,
  ): Promise<void> {
    // Verify webhook signature
    const hash = crypto
      .createHmac('sha256', this.sudoConfig.webhookSecret)
      .update(payload)
      .digest('hex');

    if (hash !== signature) {
      this.logger.warn('Invalid Sudo webhook signature');
      throw new BadRequestException('Invalid signature');
    }

    const data: SudoWebhookPayload = JSON.parse(payload.toString());

    // Find card by Sudo card ID
    const card = await this.cardRepo.findOne({
      where: { sudoCardId: data.cardId },
    });
    if (!card) {
      this.logger.warn(
        `No card found for Sudo cardId ${data.cardId}`,
      );
      return;
    }

    // Process based on event type
    if (data.eventType === 'card.transaction') {
      await this.handleCardTransaction(card, data);
    } else if (data.eventType === 'card.spend') {
      await this.handleCardSpend(card, data);
    }
  }

  // Private helper methods

  private async createCardViaSudo(dto: CreateVirtualCardDto): Promise<SudoCardResponse> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post<SudoCardResponse>(
          `${this.sudoConfig.baseUrl}/cards`,
          {
            billingName: dto.billingName,
            billingAddress: dto.billingAddress,
            currency: 'USD',
          },
          {
            headers: {
              Authorization: `Bearer ${this.sudoConfig.apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to create card via Sudo: ${message}`);
      throw new BadRequestException('Failed to create card');
    }
  }

  private async fundCardViaSudo(sudoCardId: string, amountUsd: number): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.sudoConfig.baseUrl}/cards/${sudoCardId}/fund`,
          { amount: amountUsd },
          {
            headers: {
              Authorization: `Bearer ${this.sudoConfig.apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to fund card via Sudo: ${message}`);
      throw new BadRequestException('Failed to fund card');
    }
  }

  private async freezeCardViaSudo(sudoCardId: string, freeze: boolean): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.patch(
          `${this.sudoConfig.baseUrl}/cards/${sudoCardId}`,
          { status: freeze ? 'frozen' : 'active' },
          {
            headers: {
              Authorization: `Bearer ${this.sudoConfig.apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to freeze card via Sudo: ${message}`);
      throw new BadRequestException('Failed to update card status');
    }
  }

  private async terminateCardViaSudo(sudoCardId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.delete(
          `${this.sudoConfig.baseUrl}/cards/${sudoCardId}`,
          {
            headers: {
              Authorization: `Bearer ${this.sudoConfig.apiKey}`,
            },
          },
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to terminate card via Sudo: ${message}`);
      throw new BadRequestException('Failed to terminate card');
    }
  }

  private async handleCardTransaction(card: VirtualCard, payload: SudoWebhookPayload): Promise<void> {
    // Create transaction record for card spend
    const transactionAmount = payload.amount.toString();
    const currentBalance = await this.getUserBalance(card.userId);

    await this.txRepo.save(
      this.txRepo.create({
        userId: card.userId,
        type: TransactionType.VIRTUAL_CARD_SPEND,
        amountUsdc: transactionAmount,
        amount: payload.amount,
        currency: 'USDC',
        status: TransactionStatus.COMPLETED,
        reference: payload.transactionId,
        description: `Virtual card purchase at ${payload.merchant}`,
        metadata: {
          cardId: card.id,
          sudoCardId: card.sudoCardId,
          merchant: payload.merchant,
          timestamp: payload.timestamp,
        },
        balanceAfter: currentBalance.toString(),
      }),
    );

    this.logger.log(
      `Card transaction recorded: ${payload.amount} USD at ${payload.merchant}`,
    );
  }

  private async handleCardSpend(card: VirtualCard, payload: SudoWebhookPayload): Promise<void> {
    // Similar to transaction handling
    await this.handleCardTransaction(card, payload);
  }

  private async getUserBalance(userId: string): Promise<number> {
    // TODO: Implement balance retrieval from Soroban
    // For now, return a placeholder
    return 0;
  }
}
