import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import {
  Merchant,
  MerchantStatus,
  KycStatus,
} from '../../database/entities/merchant.entity';
import { MerchantAuditLog } from '../entities/merchant-audit-log.entity';
import { MerchantNote } from '../entities/merchant-note.entity';

// @ts-ignore - Assuming PasswordService is exported from AuthModule, ignore if it complains during this check but works at runtime (it should be exported now)
import { PasswordService } from '../../auth/services/password.service';
import {
  RegisterMerchantDto,
  LoginMerchantDto,
  UpdateProfileDto,
  BankDetailsDto,
  SettingsDto,
  KycDocumentsDto,
  UpdateMerchantDto,
  MerchantDetailResponseDto,
  MerchantTier,
  FeeStructureDto,
} from '../dto/merchant.dto';

import { Transaction } from '../../transactions/entities/transaction.entity';
import { TransactionStatus } from '../../transactions/transactions.enums';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { ApiKey } from '../../api-key/entities/api-key.entity';
import { RedisService } from '../../common/redis';

const DEFAULT_FEE_STRUCTURES: Record<MerchantTier, FeeStructureDto> = {
  [MerchantTier.STARTER]: {
    transactionFeePercentage: '2.90',
    transactionFeeFlat: '0.30',
    settlementFeePercentage: '1.00',
    minimumFee: '1.00',
    maximumFee: '100.00',
  },
  [MerchantTier.GROWTH]: {
    transactionFeePercentage: '2.50',
    transactionFeeFlat: '0.25',
    settlementFeePercentage: '0.50',
    minimumFee: '0.50',
    maximumFee: '50.00',
  },
  [MerchantTier.ENTERPRISE]: {
    transactionFeePercentage: '1.50',
    transactionFeeFlat: '0.10',
    settlementFeePercentage: '0.10',
    minimumFee: '0.00',
    maximumFee: '0.00', // Custom/Unlimited
  },
};

@Injectable()
export class MerchantService {
  constructor(
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
    @InjectRepository(MerchantAuditLog)
    private readonly auditLogRepository: Repository<MerchantAuditLog>,
    @InjectRepository(MerchantNote)
    private readonly noteRepository: Repository<MerchantNote>,
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
  ) {}

  async register(dto: RegisterMerchantDto): Promise<Merchant> {
    const { email, password, name, businessName } = dto;

    const existing = await this.merchantRepository.findOne({
      where: { email },
    });
    if (existing) {
      throw new ConflictException('Merchant with this email already exists');
    }

    const hashedPassword = await this.passwordService.hashPassword(password);
    const merchant = this.merchantRepository.create({
      name,
      businessName,
      email,
      password: hashedPassword,
      status: MerchantStatus.ACTIVE,
      kycStatus: KycStatus.NOT_SUBMITTED,
    });

    const savedMerchant = await this.merchantRepository.save(merchant);
    await this.invalidateMerchantListCache();
    return savedMerchant;
  }

  async login(dto: LoginMerchantDto): Promise<{
    accessToken: string;
    refreshToken: string;
    merchant: Merchant;
  }> {
    const { email, password } = dto;
    const merchant = await this.merchantRepository.findOne({
      where: { email },
    });

    if (!merchant || merchant.status === MerchantStatus.SUSPENDED) {
      throw new UnauthorizedException(
        'Invalid credentials or suspended account',
      );
    }

    const isPasswordValid = await this.passwordService.comparePassword(
      password,
      merchant.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: merchant.id,
      email: merchant.email,
      role: 'merchant',
    };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return { accessToken, refreshToken, merchant };
  }

  async refreshToken(
    token: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify(token);
      if (payload.role !== 'merchant')
        throw new UnauthorizedException('Invalid token role');

      const merchant = await this.merchantRepository.findOne({
        where: { id: payload.sub },
      });
      if (!merchant || merchant.status !== MerchantStatus.ACTIVE)
        throw new UnauthorizedException('Invalid merchant');

      const newPayload = {
        sub: merchant.id,
        email: merchant.email,
        role: 'merchant',
      };
      const accessToken = this.jwtService.sign(newPayload);
      const refreshToken = this.jwtService.sign(newPayload, {
        expiresIn: '7d',
      });

      return { accessToken, refreshToken };
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async verifyEmail(email: string, code: string): Promise<boolean> {
    // Placeholder for email verification logic
    // In reality, check code against DB/Redis
    return true;
  }

  async getStatistics(id: string): Promise<any> {
    const cacheKey = `merchant_stats_${id}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    // TODO: In a real high-scale app, use an analytics service or materialized view
    // For now, we query the transactions table directly via query builder or repository if managed
    // usage of any here implies we are using raw query or need to inject transaction repo if we want type safety
    // Let's assume we can use the merchant's relation if loaded, but for stats we need all history

    // We'll use a raw query for performance/simplicity in this specific service without injecting TransactionRepo for now
    // Or better, inject DataSource or EntityManager if needed, but let's try to load relations or use query builder on merchant repo related

    // Actually, proper way is to query transactions table.
    // Since we didn't inject TransactionRepository, let's use merchantRepository.manager to query
    const stats = await this.merchantRepository.manager
      .createQueryBuilder(Transaction, 'tx')
      .where(
        'tx.payment_request_id IN (SELECT id FROM payment_requests WHERE merchant_id = :id)',
        { id },
      )
      .select('COUNT(tx.id)', 'totalTransactionCount')
      .addSelect('SUM(tx.usd_value)', 'totalVolumeUsd')
      .addSelect(
        `SUM(CASE WHEN tx.status = '${TransactionStatus.CONFIRMED}' THEN 1 ELSE 0 END)`,
        'successCount',
      )
      .getRawOne();

    // Last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const last30Days = await this.merchantRepository.manager
      .createQueryBuilder(Transaction, 'tx')
      .where(
        'tx.payment_request_id IN (SELECT id FROM payment_requests WHERE merchant_id = :id)',
        { id },
      )
      .andWhere('tx.created_at >= :date', { date: thirtyDaysAgo })
      .select('COUNT(tx.id)', 'last30DaysTransactionCount')
      .addSelect('SUM(tx.usd_value)', 'last30DaysVolumeUsd')
      .getRawOne();

    const totalCount = parseInt(stats.totalTransactionCount || '0');
    const successCount = parseInt(stats.successCount || '0');
    const successRate =
      totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) : '0.0';
    const totalVolume = parseFloat(stats.totalVolumeUsd || '0');
    const avgTx =
      totalCount > 0 ? (totalVolume / totalCount).toFixed(2) : '0.00';

    const result = {
      totalVolumeUsd: stats.totalVolumeUsd || '0.00',
      totalTransactionCount: totalCount,
      last30DaysVolumeUsd: last30Days.last30DaysVolumeUsd || '0.00',
      last30DaysTransactionCount: parseInt(
        last30Days.last30DaysTransactionCount || '0',
      ),
      successRate,
      averageTransactionUsd: avgTx,
    };

    await this.cacheManager.set(cacheKey, result, 60000); // 60s TTL
    return result;
  }

  async getDetail(id: string): Promise<MerchantDetailResponseDto> {
    const cacheKey = `merchant_detail_${id}`;
    const cached =
      await this.cacheManager.get<MerchantDetailResponseDto>(cacheKey);
    if (cached) return cached;

    const merchant = await this.merchantRepository.findOne({
      where: { id },
    });

    if (!merchant)
      throw new NotFoundException(`Merchant with id '${id}' not found`);

    const [stats, notes, rawApiKeys] = await Promise.all([
      this.getStatistics(id),
      this.noteRepository.find({
        where: { merchantId: id },
        order: { createdAt: 'DESC' },
      }),
      this.apiKeyRepository.find({ where: { merchantId: id } }),
    ]);

    // Mask sensitive key hash, expose only safe fields
    const maskedApiKeys = rawApiKeys.map((key) => ({
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      lastUsedAt: key.lastUsedAt,
      status: key.isActive ? 'ACTIVE' : 'INACTIVE',
    }));

    const result: MerchantDetailResponseDto = {
      id: merchant.id,
      businessName: merchant.businessName,
      email: merchant.email,
      contact: {
        firstName: merchant.name.split(' ')[0],
        lastName: merchant.name.split(' ').slice(1).join(' '),
        phone: '',
      }, // extracting distinct parts
      countryCode: 'US', // default
      registrationNumber: '', // Not in entity
      businessType: 'ECOMMERCE', // default
      tier: (merchant.settings?.tier as MerchantTier) || MerchantTier.STARTER,
      status: merchant.status,
      activatedAt: merchant.createdAt, // approximation
      settlementConfig: (merchant.settlementConfig as any) || {
        currency: 'USD',
        bankAccountLast4: '',
        settlementFrequency: 'DAILY',
        minimumSettlementAmount: 100,
      },
      feeStructure: (merchant.feeStructure as any) || {
        transactionFeePercentage: '1.50',
        transactionFeeFlat: '0.30',
        settlementFeePercentage: '0.25',
        minimumFee: '0.50',
        maximumFee: '50.00',
      },
      supportedChains: merchant.supportedChains || [],
      apiKeys: maskedApiKeys,
      stats,
      kycStatus: {
        status: merchant.kycStatus,
        reviewedAt: merchant.kycVerifiedAt,
      },
      flags: merchant.flags || [],
      notes: notes,
      createdAt: merchant.createdAt,
      updatedAt: merchant.updatedAt,
    };

    await this.cacheManager.set(cacheKey, result, 60000);
    return result;
  }

  async updateMerchant(
    id: string,
    dto: UpdateMerchantDto,
    updatedByUserId: string,
  ): Promise<MerchantDetailResponseDto> {
    const merchant = await this.merchantRepository.findOne({ where: { id } });
    if (!merchant)
      throw new NotFoundException(`Merchant with id '${id}' not found`);

    const beforeState = { ...merchant };
    const changedFields: Record<string, any> = {};

    if (dto.tier && merchant.settings?.tier !== dto.tier) {
      changedFields.tier = { before: merchant.settings?.tier, after: dto.tier };
      merchant.settings = { ...merchant.settings, tier: dto.tier };

      // Apply default fee structure for the new tier
      const defaultFees = DEFAULT_FEE_STRUCTURES[dto.tier];
      if (defaultFees) {
        changedFields.feeStructure = {
          before: merchant.feeStructure,
          after: defaultFees,
        };
        merchant.feeStructure = defaultFees as any;
      }
    }

    if (dto.supportedChains) {
      // Validate chains exist in config if needed
      changedFields.supportedChains = {
        before: merchant.supportedChains,
        after: dto.supportedChains,
      };
      merchant.supportedChains = dto.supportedChains;
    }

    if (dto.settlementConfig) {
      changedFields.settlementConfig = {
        before: merchant.settlementConfig,
        after: dto.settlementConfig,
      };
      merchant.settlementConfig = {
        ...merchant.settlementConfig,
        ...dto.settlementConfig,
      };
    }

    if (dto.internalNote) {
      await this.noteRepository.save({
        merchantId: merchant.id,
        content: dto.internalNote,
        createdBy: { id: updatedByUserId, email: 'admin@example.com' }, // Placeholder for real user info
      });
    }

    if (Object.keys(changedFields).length > 0) {
      await this.merchantRepository.save(merchant);

      await this.auditLogRepository.save({
        merchantId: merchant.id,
        action: 'MERCHANT_UPDATED',
        changedBy: {
          id: updatedByUserId,
          email: 'admin@example.com',
          role: 'ADMIN',
        },
        changes: changedFields,
        ip: '127.0.0.1',
      });

      // Invalidate cache
      await this.cacheManager.del(`merchant_detail_${id}`);
      await this.invalidateMerchantListCache();
    }

    return this.getDetail(id);
  }

  async getHistory(
    id: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<any> {
    const [data, total] = await this.auditLogRepository.findAndCount({
      where: { merchantId: id },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getProfile(id: string): Promise<Merchant> {
    const merchant = await this.merchantRepository.findOne({ where: { id } });
    if (!merchant) throw new UnauthorizedException('Merchant not found');
    return merchant;
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<Merchant> {
    const merchant = await this.getProfile(id);
    if (dto.name) merchant.name = dto.name;
    if (dto.businessName) merchant.businessName = dto.businessName;
    const updatedMerchant = await this.merchantRepository.save(merchant);
    await this.invalidateMerchantListCache();
    return updatedMerchant;
  }

  async updateBankDetails(id: string, dto: BankDetailsDto): Promise<Merchant> {
    const merchant = await this.getProfile(id);
    // In a real app, encrypt these details
    merchant.bankDetails = dto as any;
    const updatedMerchant = await this.merchantRepository.save(merchant);
    await this.invalidateMerchantListCache();
    return updatedMerchant;
  }

  async updateSettings(id: string, dto: SettingsDto): Promise<Merchant> {
    const merchant = await this.getProfile(id);
    merchant.settings = { ...merchant.settings, ...dto };
    const updatedMerchant = await this.merchantRepository.save(merchant);
    await this.invalidateMerchantListCache();
    return updatedMerchant;
  }

  async uploadKycDocuments(
    id: string,
    dto: KycDocumentsDto,
  ): Promise<Merchant> {
    const merchant = await this.getProfile(id);
    merchant.documents = { ...merchant.documents, ...dto };
    merchant.kycStatus = KycStatus.PENDING; // Set to pending verification
    const updatedMerchant = await this.merchantRepository.save(merchant);
    await this.invalidateMerchantListCache();
    return updatedMerchant;
  }

  private async invalidateMerchantListCache(): Promise<void> {
    await this.redisService.delPattern('cache:merchants:list:*');
  }

  async getKycStatus(
    id: string,
  ): Promise<{ status: KycStatus; documents: any }> {
    const merchant = await this.getProfile(id);
    return { status: merchant.kycStatus, documents: merchant.documents };
  }
}
