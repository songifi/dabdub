import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Deposit, DepositStatus } from './entities/deposit.entity';
import { Transaction, TransactionType, TransactionStatus } from '../transactions/entities/transaction.entity';
import { VirtualAccount } from '../virtual-account/entities/virtual-account.entity';

@Injectable()
export class DepositsService {
  private readonly logger = new Logger(DepositsService.name);

  constructor(
    @InjectRepository(Deposit)
    private readonly depositRepo: Repository<Deposit>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
  ) {}

  async createDeposit(
    userId: string,
    virtualAccount: VirtualAccount,
    ngnAmount: number,
    usdcAmount: number,
    reference: string,
    flutterwaveReference?: string,
  ): Promise<Deposit> {
    const deposit = this.depositRepo.create({
      userId,
      virtualAccountId: virtualAccount.id,
      virtualAccount,
      ngnAmount,
      usdcAmount,
      reference,
      status: DepositStatus.COMPLETED,
      flutterwaveReference: flutterwaveReference || null,
    });

    const savedDeposit = await this.depositRepo.save(deposit);

    // Create corresponding transaction
    const transaction = this.transactionRepo.create({
      userId,
      type: TransactionType.DEPOSIT,
      amount: usdcAmount,
      currency: 'USDC',
      status: TransactionStatus.COMPLETED,
      reference,
      description: `NGN deposit via virtual account`,
      depositId: savedDeposit.id,
      deposit: savedDeposit,
    });

    await this.transactionRepo.save(transaction);

    this.logger.log(`Created deposit and transaction for user ${userId}: ${usdcAmount} USDC`);

    return savedDeposit;
  }
}