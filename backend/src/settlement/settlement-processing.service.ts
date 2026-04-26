import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settlement, SettlementStatus } from './entities/settlement.entity';
import { QueueRegistryService } from '../queue/queue.registry';
import { Merchant } from '../merchants/entities/merchant.entity';
import { BankAccount } from '../bank-accounts/entities/bank-account.entity';
import { RatesService } from '../rates/rates.service';

@Injectable()
export class SettlementProcessingService {
  private readonly logger = new Logger(SettlementProcessingService.name);

  constructor(
    @InjectRepository(Settlement)
    private readonly settlementRepo: Repository<Settlement>,
    @InjectRepository(Merchant)
    private readonly merchantRepo: Repository<Merchant>,
    @InjectRepository(BankAccount)
    private readonly bankAccountRepo: Repository<BankAccount>,
    private readonly queueRegistry: QueueRegistryService,
    private readonly ratesService: RatesService,
  ) {}

  async enqueueSettlement(merchantId: string, amount: number, tokenId: string) {
    this.logger.log(`Queueing settlement for merchant ${merchantId}, amount ${amount}`);
    
    const merchant = await this.merchantRepo.findOne({ where: { userId: merchantId } });
    if (!merchant) {
      this.logger.error(`Merchant not found for user ${merchantId}`);
      return;
    }

    if (!merchant.autoSettleEnabled) {
      this.logger.debug(`Auto-settle disabled for merchant ${merchant.id}`);
      return;
    }

    const defaultBankAccount = await this.bankAccountRepo.findOne({
      where: { userId: merchantId, isDefault: true },
    });

    if (!defaultBankAccount) {
      this.logger.warn(`No default bank account for merchant ${merchantId}, cannot settle.`);
      return;
    }

    const rateData = await this.ratesService.getRate('USDC', 'NGN');
    const rate = Number(rateData.rate);
    const ngnAmount = amount * rate;

    const settlement = this.settlementRepo.create({
      merchantId: merchant.userId,
      userId: merchantId,
      usdcAmount: amount,
      ngnAmount,
      rate,
      status: SettlementStatus.QUEUED,
      bankAccountId: defaultBankAccount.id,
    });

    const saved = await this.settlementRepo.save(settlement);

    await this.queueRegistry.add('settlement-jobs', 'process-settlement', {
      settlementId: saved.id,
      merchantId: merchant.userId,
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: true,
    });

    this.logger.log(`Enqueued settlement job ${saved.id} for merchant ${merchant.id}`);
    return saved;
  }
}
