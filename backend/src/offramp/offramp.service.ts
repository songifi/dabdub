import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindManyOptions, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { OffRamp, OffRampProvider, OffRampStatus } from './entities/off-ramp.entity';
import { BankAccount } from '../bank-accounts/entities/bank-account.entity';
import { User } from '../users/entities/user.entity';
import { TierConfig } from '../tier-config/entities/tier-config.entity';
import { FeeConfig, FeeType } from '../fee-config/entities/fee-config.entity';
import { Transaction, TransactionStatus, TransactionType } from '../transactions/entities/transaction.entity';
import { RatesService } from '../rates/rates.service';
import { SorobanService } from '../soroban/soroban.service';
import { PinService } from '../pin/pin.service';
import { FlutterwaveService } from '../flutterwave/flutterwave.service';
import {
  AdminOffRampQueryDto,
  ExecuteOffRampDto,
  OffRampPreviewResponseDto,
  OffRampResponseDto,
  PreviewOffRampDto,
} from './dto/offramp.dto';

export const MIN_OFFRAMP_USDC = 1;
export const SPREAD_PERCENT = 1.5; // 1.5% spread
export const RATE_LOCK_THRESHOLD = 0.02; // 2% max rate change

@Injectable()
export class OffRampService {
  private readonly logger = new Logger(OffRampService.name);

  constructor(
    @InjectRepository(OffRamp)
    private readonly offRampRepo: Repository<OffRamp>,
    @InjectRepository(BankAccount)
    private readonly bankAccountRepo: Repository<BankAccount>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(TierConfig)
    private readonly tierConfigRepo: Repository<TierConfig>,
    @InjectRepository(FeeConfig)
    private readonly feeConfigRepo: Repository<FeeConfig>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly ratesService: RatesService,
    private readonly sorobanService: SorobanService,
    private readonly pinService: PinService,
    private readonly flutterwaveService: FlutterwaveService,
    private readonly configService: ConfigService,
  ) {}

  // ── Preview ─────────────────────────────────────────────────────────────────

  async preview(userId: string, dto: PreviewOffRampDto): Promise<OffRampPreviewResponseDto> {
    const { amountUsdc } = dto;

    if (amountUsdc < MIN_OFFRAMP_USDC) {
      throw new BadRequestException(`Minimum off-ramp amount is $${MIN_OFFRAMP_USDC} USDC`);
    }

    const [rateData, feeConfig, defaultBank] = await Promise.all([
      this.ratesService.getRate('USDC', 'NGN'),
      this.feeConfigRepo.findOne({ where: { feeType: FeeType.WITHDRAWAL, isActive: true } }),
      this.bankAccountRepo.findOne({ where: { userId, isDefault: true } }),
    ]);

    const rate = parseFloat(rateData.rate);
    const { feeUsdc, netAmountUsdc } = this.computeFee(amountUsdc, feeConfig);
    const ngnAmount = (netAmountUsdc * rate * (1 - SPREAD_PERCENT / 100)).toFixed(2);

    return {
      amountUsdc,
      rate: rateData.rate,
      spreadPercent: SPREAD_PERCENT,
      feeUsdc: feeUsdc.toFixed(8),
      netAmountUsdc: netAmountUsdc.toFixed(8),
      ngnAmount,
      bankAccount: defaultBank
        ? {
            id: defaultBank.id,
            bankName: defaultBank.bankName,
            accountNumber: defaultBank.accountNumber,
            accountName: defaultBank.accountName,
          }
        : null,
    };
  }

  // ── Execute ─────────────────────────────────────────────────────────────────

  async execute(userId: string, dto: ExecuteOffRampDto): Promise<OffRampResponseDto> {
    // 1. Minimum amount guard
    if (dto.amountUsdc < MIN_OFFRAMP_USDC) {
      throw new BadRequestException(`Minimum off-ramp amount is $${MIN_OFFRAMP_USDC} USDC`);
    }

    // 2. Verify PIN
    await this.pinService.verifyPin(userId, dto.pin);

    // 3. Load user + tier
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // 4. Load bank account
    const bankAccount = await this.bankAccountRepo.findOne({
      where: { id: dto.bankAccountId, userId },
    });
    if (!bankAccount) throw new NotFoundException('Bank account not found');

    // 5. Check tier limits
    await this.checkSpendLimits(user, dto.amountUsdc);

    // 6. Re-compute amounts with fresh rate
    const [rateData, feeConfig] = await Promise.all([
      this.ratesService.getRate('USDC', 'NGN'),
      this.feeConfigRepo.findOne({ where: { feeType: FeeType.WITHDRAWAL, isActive: true } }),
    ]);

    const rate = parseFloat(rateData.rate);
    const { feeUsdc, netAmountUsdc } = this.computeFee(dto.amountUsdc, feeConfig);
    const ngnAmount = (netAmountUsdc * rate * (1 - SPREAD_PERCENT / 100)).toFixed(2);

    // 7. Rate lock: reject if rate moved > 2% since preview
    this.checkRateLock(parseFloat(dto.previewRate), rate);

    // 8. Create off-ramp record
    const reference = `OFFRAMP-${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
    const offRamp = this.offRampRepo.create({
      userId,
      amountUsdc: dto.amountUsdc.toFixed(8),
      feeUsdc: feeUsdc.toFixed(8),
      netAmountUsdc: netAmountUsdc.toFixed(8),
      rate: rateData.rate,
      spreadPercent: SPREAD_PERCENT.toFixed(2),
      ngnAmount,
      bankAccountId: bankAccount.id,
      bankAccountNumber: bankAccount.accountNumber,
      bankName: bankAccount.bankName,
      accountName: bankAccount.accountName,
      reference,
      status: OffRampStatus.PENDING,
    });
    const saved = await this.offRampRepo.save(offRamp);

    // 9. Deduct USDC on-chain via Soroban
    try {
      await this.sorobanService.withdraw(user.username, dto.amountUsdc.toFixed(8));
      await this.offRampRepo.update(saved.id, { status: OffRampStatus.USDC_DEDUCTED });
    } catch (err: any) {
      await this.offRampRepo.update(saved.id, {
        status: OffRampStatus.FAILED,
        failureReason: `USDC deduction failed: ${err.message}`,
      });
      throw new BadRequestException(`Failed to deduct USDC: ${err.message}`);
    }

    // 10. Initiate NGN transfer — try Paystack first, fall back to Flutterwave
    let usedProvider = OffRampProvider.PAYSTACK;
    let providerRef: string;
    try {
      providerRef = await this.initiateNgnTransferPaystack(
        bankAccount,
        parseFloat(ngnAmount),
        reference,
      );
    } catch (paystackErr: any) {
      this.logger.warn(
        `Paystack transfer failed for ${reference} (${paystackErr.message}), attempting Flutterwave fallback`,
      );
      try {
        providerRef = await this.initiateNgnTransferFlutterwave(
          bankAccount,
          parseFloat(ngnAmount),
          reference,
        );
        usedProvider = OffRampProvider.FLUTTERWAVE;
      } catch (flwErr: any) {
        // Both providers failed — refund USDC
        this.logger.error(`Both providers failed for ${reference}: ${flwErr.message}`);
        await this.refundUsdc(user.username, dto.amountUsdc.toFixed(8), saved.id, flwErr.message);
        throw new BadRequestException(`NGN transfer failed: ${flwErr.message}`);
      }
    }

    await this.offRampRepo.update(saved.id, {
      status: OffRampStatus.TRANSFER_INITIATED,
      providerReference: providerRef,
      provider: usedProvider,
    });

    // 11. Create Transaction record
    const tx = this.transactionRepo.create({
      userId,
      type: TransactionType.WITHDRAWAL,
      amountUsdc: dto.amountUsdc.toFixed(8),
      amount: dto.amountUsdc,
      currency: 'USDC',
      fee: feeUsdc.toFixed(8),
      balanceAfter: '0', // Updated by balance sync
      status: TransactionStatus.PENDING,
      reference,
      description: `Off-ramp: ${dto.amountUsdc} USDC → ${ngnAmount} NGN`,
      metadata: { offRampId: saved.id, bankAccountId: bankAccount.id },
    });
    const savedTx = await this.transactionRepo.save(tx);
    await this.offRampRepo.update(saved.id, { transactionId: savedTx.id });

    const result = await this.offRampRepo.findOne({ where: { id: saved.id } });
    return OffRampResponseDto.from(result!);
  }

  // ── Get status ──────────────────────────────────────────────────────────────

  async getStatus(userId: string, referenceId: string): Promise<OffRampResponseDto> {
    const offRamp = await this.offRampRepo.findOne({
      where: { reference: referenceId, userId },
    });
    if (!offRamp) throw new NotFoundException('Off-ramp not found');

    // Poll provider for latest status if transfer was initiated
    if (
      offRamp.status === OffRampStatus.TRANSFER_INITIATED &&
      offRamp.providerReference
    ) {
      const providerStatus = await this.pollProviderStatus(
        offRamp.providerReference,
        offRamp.provider,
      );
      if (providerStatus === 'success') {
        await this.offRampRepo.update(offRamp.id, { status: OffRampStatus.COMPLETED });
        offRamp.status = OffRampStatus.COMPLETED;
        if (offRamp.transactionId) {
          await this.transactionRepo.update(offRamp.transactionId, {
            status: TransactionStatus.COMPLETED,
          });
        }
      } else if (providerStatus === 'failed') {
        await this.offRampRepo.update(offRamp.id, {
          status: OffRampStatus.FAILED,
          failureReason: 'Provider transfer failed',
        });
        offRamp.status = OffRampStatus.FAILED;
      }
    }

    return OffRampResponseDto.from(offRamp);
  }

  // ── History ─────────────────────────────────────────────────────────────────

  async getHistory(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: OffRampResponseDto[]; total: number; page: number; limit: number }> {
    const [offRamps, total] = await this.offRampRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: offRamps.map(OffRampResponseDto.from),
      total,
      page,
      limit,
    };
  }

  // ── Admin methods ────────────────────────────────────────────────────────────

  async adminList(
    query: AdminOffRampQueryDto,
  ): Promise<{ data: OffRampResponseDto[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: FindManyOptions<OffRamp>['where'] = {};
    if (query.status) (where as any).status = query.status;
    if (query.userId) (where as any).userId = query.userId;
    if (query.dateFrom && query.dateTo) {
      (where as any).createdAt = Between(new Date(query.dateFrom), new Date(query.dateTo));
    }

    const [offRamps, total] = await this.offRampRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: offRamps.map(OffRampResponseDto.from),
      total,
      page,
      limit,
    };
  }

  async adminGetById(id: string): Promise<OffRampResponseDto> {
    const offRamp = await this.offRampRepo.findOne({ where: { id } });
    if (!offRamp) throw new NotFoundException(`Off-ramp ${id} not found`);
    return OffRampResponseDto.from(offRamp);
  }

  async adminRefund(id: string): Promise<OffRampResponseDto> {
    const offRamp = await this.offRampRepo.findOne({ where: { id } });
    if (!offRamp) throw new NotFoundException(`Off-ramp ${id} not found`);

    const refundableStatuses = [OffRampStatus.FAILED, OffRampStatus.USDC_DEDUCTED, OffRampStatus.TRANSFER_INITIATED];
    if (!refundableStatuses.includes(offRamp.status)) {
      throw new ForbiddenException(
        `Off-ramp is in status '${offRamp.status}' and cannot be refunded`,
      );
    }

    const user = await this.userRepo.findOne({ where: { id: offRamp.userId } });
    if (!user) throw new NotFoundException('User associated with off-ramp not found');

    await this.refundUsdc(
      user.username,
      offRamp.amountUsdc,
      offRamp.id,
      'Admin-initiated manual refund',
    );

    const updated = await this.offRampRepo.findOne({ where: { id } });
    return OffRampResponseDto.from(updated!);
  }

  // ── Reconciliation (called by processor) ────────────────────────────────────

  async reconcileStaleOrders(): Promise<void> {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

    const stale = await this.offRampRepo
      .createQueryBuilder('o')
      .where('o.status = :status', { status: OffRampStatus.TRANSFER_INITIATED })
      .andWhere('o.updatedAt < :cutoff', { cutoff })
      .andWhere('o.providerReference IS NOT NULL')
      .getMany();

    this.logger.log(`Reconciling ${stale.length} stale off-ramp order(s)`);

    for (const order of stale) {
      try {
        const providerStatus = await this.pollProviderStatus(
          order.providerReference!,
          order.provider,
        );

        if (providerStatus === 'success') {
          await this.offRampRepo.update(order.id, { status: OffRampStatus.COMPLETED });
          if (order.transactionId) {
            await this.transactionRepo.update(order.transactionId, {
              status: TransactionStatus.COMPLETED,
            });
          }
          this.logger.log(`Reconciled ${order.reference} → completed`);
        } else if (providerStatus === 'failed') {
          const user = await this.userRepo.findOne({ where: { id: order.userId } });
          if (user) {
            await this.refundUsdc(user.username, order.amountUsdc, order.id, 'Reconciliation: provider reported failed');
          }
          this.logger.warn(`Reconciled ${order.reference} → failed, triggered refund`);
        }
      } catch (err: any) {
        this.logger.error(`Reconciliation error for ${order.reference}: ${err.message}`);
      }
    }
  }

  // ── Webhook handlers (called by webhook controller) ──────────────────────────

  async handlePaystackTransferSuccess(transferCode: string, reference: string): Promise<void> {
    const offRamp = await this.offRampRepo.findOne({ where: { reference } });
    if (!offRamp) {
      this.logger.warn(`Paystack webhook: no off-ramp found for reference ${reference}`);
      return;
    }
    if (offRamp.status === OffRampStatus.COMPLETED) return; // idempotent

    await this.offRampRepo.update(offRamp.id, {
      status: OffRampStatus.COMPLETED,
      providerReference: transferCode,
    });

    if (offRamp.transactionId) {
      await this.transactionRepo.update(offRamp.transactionId, {
        status: TransactionStatus.COMPLETED,
      });
    }
    this.logger.log(`Paystack webhook: ${reference} marked completed`);
  }

  async handlePaystackTransferFailed(transferCode: string, reference: string): Promise<void> {
    const offRamp = await this.offRampRepo.findOne({ where: { reference } });
    if (!offRamp) {
      this.logger.warn(`Paystack webhook: no off-ramp found for reference ${reference}`);
      return;
    }
    if ([OffRampStatus.FAILED, OffRampStatus.REFUNDED].includes(offRamp.status)) return; // idempotent

    const user = await this.userRepo.findOne({ where: { id: offRamp.userId } });
    if (user) {
      await this.refundUsdc(
        user.username,
        offRamp.amountUsdc,
        offRamp.id,
        `Paystack webhook: transfer ${transferCode} failed`,
      );
    } else {
      await this.offRampRepo.update(offRamp.id, {
        status: OffRampStatus.FAILED,
        failureReason: `Paystack webhook: transfer ${transferCode} failed — user not found for refund`,
      });
    }

    if (offRamp.transactionId) {
      await this.transactionRepo.update(offRamp.transactionId, {
        status: TransactionStatus.FAILED,
      });
    }
    this.logger.warn(`Paystack webhook: ${reference} marked failed, refund initiated`);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  computeFee(
    amountUsdc: number,
    feeConfig: FeeConfig | null,
  ): { feeUsdc: number; netAmountUsdc: number } {
    if (!feeConfig) {
      return { feeUsdc: 0, netAmountUsdc: amountUsdc };
    }

    const baseFeeRate = parseFloat(feeConfig.baseFeeRate);
    let feeUsdc = amountUsdc * baseFeeRate;

    const minFee = parseFloat(feeConfig.minFee);
    if (feeUsdc < minFee) feeUsdc = minFee;

    if (feeConfig.maxFee) {
      const maxFee = parseFloat(feeConfig.maxFee);
      if (feeUsdc > maxFee) feeUsdc = maxFee;
    }

    return {
      feeUsdc,
      netAmountUsdc: amountUsdc - feeUsdc,
    };
  }

  checkRateLock(previewRate: number, currentRate: number): void {
    const change = Math.abs(currentRate - previewRate) / previewRate;
    if (change > RATE_LOCK_THRESHOLD) {
      throw new BadRequestException(
        'Rate has changed significantly. Please preview again.',
      );
    }
  }

  private async checkSpendLimits(user: User, amountUsdc: number): Promise<void> {
    const tierConfig = await this.tierConfigRepo.findOne({
      where: { tier: user.tier, isActive: true },
    });
    if (!tierConfig) return;

    const maxSingle = parseFloat(tierConfig.maxSingleWithdrawalUsdc);
    if (maxSingle > 0 && amountUsdc > maxSingle) {
      throw new BadRequestException(
        `Amount exceeds your tier limit of $${maxSingle} USDC per withdrawal`,
      );
    }
  }

  // ── Provider: Paystack ───────────────────────────────────────────────────────

  private async initiateNgnTransferPaystack(
    bankAccount: BankAccount,
    ngnAmount: number,
    reference: string,
  ): Promise<string> {
    const paystackKey = this.configService.get<string>('PAYSTACK_SECRET_KEY');
    if (!paystackKey) throw new Error('PAYSTACK_SECRET_KEY not configured');

    // Create transfer recipient
    const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'nuban',
        name: bankAccount.accountName,
        account_number: bankAccount.accountNumber,
        bank_code: bankAccount.bankCode,
        currency: 'NGN',
      }),
    });

    if (!recipientRes.ok) {
      throw new Error(`Paystack recipient creation failed: ${recipientRes.status}`);
    }

    const recipientData = (await recipientRes.json()) as {
      data?: { recipient_code: string };
    };
    const recipientCode = recipientData.data?.recipient_code;
    if (!recipientCode) throw new Error('Paystack: no recipient code returned');

    // Initiate transfer
    const transferRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: Math.round(ngnAmount * 100), // Paystack uses kobo
        recipient: recipientCode,
        reason: `DabDub off-ramp ${reference}`,
        reference,
      }),
    });

    if (!transferRes.ok) {
      throw new Error(`Paystack transfer initiation failed: ${transferRes.status}`);
    }

    const transferData = (await transferRes.json()) as {
      data?: { transfer_code: string };
    };
    const transferCode = transferData.data?.transfer_code;
    if (!transferCode) throw new Error('Paystack: no transfer code returned');

    return transferCode;
  }

  // ── Provider: Flutterwave ────────────────────────────────────────────────────

  private async initiateNgnTransferFlutterwave(
    bankAccount: BankAccount,
    ngnAmount: number,
    reference: string,
  ): Promise<string> {
    const result = await this.flutterwaveService.initiateTransfer({
      accountBank: bankAccount.bankCode,
      accountNumber: bankAccount.accountNumber,
      amount: Math.round(ngnAmount), // Flutterwave uses whole NGN
      narration: `DabDub off-ramp ${reference}`,
      reference,
    });

    if (!result.id) throw new Error('Flutterwave: no transfer ID returned');
    return String(result.id);
  }

  // ── Provider: Status polling ─────────────────────────────────────────────────

  async pollProviderStatus(
    providerReference: string,
    provider: OffRampProvider = OffRampProvider.PAYSTACK,
  ): Promise<'success' | 'failed' | 'pending' | 'unknown'> {
    try {
      if (provider === OffRampProvider.FLUTTERWAVE) {
        return await this.pollFlutterwaveStatus(providerReference);
      }
      return await this.pollPaystackStatus(providerReference);
    } catch {
      return 'unknown';
    }
  }

  private async pollPaystackStatus(
    providerReference: string,
  ): Promise<'success' | 'failed' | 'pending' | 'unknown'> {
    const paystackKey = this.configService.get<string>('PAYSTACK_SECRET_KEY');
    if (!paystackKey) return 'unknown';

    const res = await fetch(
      `https://api.paystack.co/transfer/${providerReference}`,
      {
        headers: { Authorization: `Bearer ${paystackKey}` },
      },
    );
    if (!res.ok) return 'unknown';

    const data = (await res.json()) as { data?: { status: string } };
    const status = data.data?.status;

    if (status === 'success') return 'success';
    if (status === 'failed' || status === 'reversed') return 'failed';
    return 'pending';
  }

  private async pollFlutterwaveStatus(
    transferId: string,
  ): Promise<'success' | 'failed' | 'pending' | 'unknown'> {
    const status = await this.flutterwaveService.verifyTransfer(Number(transferId));
    if (status === 'SUCCESSFUL') return 'success';
    if (status === 'FAILED') return 'failed';
    return 'pending';
  }

  // ── Refund ──────────────────────────────────────────────────────────────────

  async refundUsdc(
    username: string,
    amountUsdc: string,
    offRampId: string,
    reason: string,
  ): Promise<void> {
    try {
      await this.sorobanService.deposit(username, amountUsdc);
      await this.offRampRepo.update(offRampId, {
        status: OffRampStatus.REFUNDED,
        failureReason: `Refunded after NGN transfer failure: ${reason}`,
      });
      this.logger.log(`Refunded ${amountUsdc} USDC to ${username}`);
    } catch (err: any) {
      this.logger.error(`USDC refund failed for ${username}: ${err.message}`);
      await this.offRampRepo.update(offRampId, {
        status: OffRampStatus.FAILED,
        failureReason: `NGN transfer failed AND refund failed: ${err.message}`,
      });
    }
  }
}
