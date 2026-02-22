import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import {
  FiatCurrencyConfig,
  RateSource,
} from '../database/entities/fiat-currency-config.entity';
import { Merchant } from '../database/entities/merchant.entity';
import { AuditLogService } from '../audit/audit-log.service';
import {
  AuditAction,
  ActorType,
  DataClassification,
} from '../database/entities/audit-log.enums';
import {
  AddFiatCurrencyDto,
  UpdateFiatCurrencyDto,
  UpdateBankDetailsDto,
} from './dtos/fiat-currency-config.dto';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';

@Injectable()
export class FiatCurrencyConfigService {
  private readonly logger = new Logger(FiatCurrencyConfigService.name);

  constructor(
    @InjectRepository(FiatCurrencyConfig)
    private readonly currencyRepository: Repository<FiatCurrencyConfig>,
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
    private readonly auditLogService: AuditLogService,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  async findAll(): Promise<FiatCurrencyConfig[]> {
    return this.currencyRepository.find();
  }

  async findByCode(currencyCode: string): Promise<FiatCurrencyConfig> {
    const config = await this.currencyRepository.findOne({
      where: { currencyCode },
    });
    if (!config) {
      throw new NotFoundException(`Currency config for ${currencyCode} not found`);
    }
    return config;
  }

  async create(dto: AddFiatCurrencyDto): Promise<FiatCurrencyConfig> {
    const existing = await this.currencyRepository.findOne({
      where: { currencyCode: dto.currencyCode },
    });
    if (existing) {
      throw new ConflictException(`Currency ${dto.currencyCode} already exists`);
    }

    const config = this.currencyRepository.create({
      ...dto,
      isEnabled: true,
      isDefault: false, // Default to false, can be updated later
    });

    return this.currencyRepository.save(config);
  }

  async update(
    currencyCode: string,
    dto: UpdateFiatCurrencyDto,
  ): Promise<FiatCurrencyConfig> {
    const config = await this.findByCode(currencyCode);

    // If disabling, check merchant usage
    if (dto.isEnabled === false && config.isEnabled !== false) {
      const affectedMerchants = await this.merchantRepository
        .createQueryBuilder('merchant')
        .where("merchant.settlement_config->>'settlementCurrency' = :currencyCode", {
          currencyCode,
        })
        .getMany();

      if (affectedMerchants.length > 0) {
        throw new ConflictException({
          message: `Cannot disable ${currencyCode}. It is used by active merchants.`,
          affectedMerchants: affectedMerchants.map((m) => ({
            id: m.id,
            name: m.name,
          })),
        });
      }
    }

    // Handle isDefault logic
    if (dto.isDefault === true) {
      await this.currencyRepository.update(
        { currencyCode: Not(currencyCode) },
        { isDefault: false },
      );
    }

    Object.assign(config, dto);
    return this.currencyRepository.save(config);
  }

  async updateBankDetails(
    currencyCode: string,
    dto: UpdateBankDetailsDto,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<FiatCurrencyConfig> {
    const config = await this.findByCode(currencyCode);
    const beforeState = JSON.parse(JSON.stringify(config.settlementBankDetails || {}));

    config.settlementBankDetails = {
      bankName: dto.bankName,
      accountName: dto.accountName,
      accountNumber: dto.accountNumber,
      routingCode: dto.routingCode,
      swiftCode: dto.swiftCode,
      bankAddress: dto.bankAddress,
      country: dto.country,
      ...dto.additionalDetails,
    };

    const saved = await this.currencyRepository.save(config);

    // Log the update with permanent retention (null retentionUntil in this system)
    await this.auditLogService.log({
      entityType: 'FiatCurrencyConfig',
      entityId: saved.id,
      action: AuditAction.UPDATE,
      actorId,
      actorType: ActorType.ADMIN,
      beforeState: { bankDetails: beforeState },
      afterState: { bankDetails: config.settlementBankDetails },
      ipAddress,
      userAgent,
      metadata: {
        type: 'SETTLEMENT_BANK_DETAILS_UPDATED',
        currencyCode,
      },
      dataClassification: DataClassification.SENSITIVE,
    });

    return saved;
  }

  async getRateHistory(currencyCode: string): Promise<any> {
    // This would ideally integrate with ExchangeRateService's history
    // For now, return a placeholder or use the repository if available
    return this.exchangeRateService.getRate(`${currencyCode}-USD`); // Example: relative to USD
  }

  async validateRateFeed(currencyCode: string): Promise<any> {
    const config = await this.findByCode(currencyCode);
    const start = Date.now();
    try {
      // Logic to test connectivity based on rateSource and rateSourceConfig
      // For now, use ExchangeRateService to fetch a rate
      const rate = await this.exchangeRateService.getRate(`${currencyCode}-USD`);
      const latency = Date.now() - start;
      return {
        success: true,
        rate,
        latency,
        source: config.rateSource,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        latency: Date.now() - start,
        source: config.rateSource,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Validate operating hours format HH:mm-HH:mm
   */
  validateOperatingHours(hours: Record<string, string>): void {
    const regex = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/;
    for (const [day, range] of Object.entries(hours)) {
      if (!regex.test(range)) {
        throw new BadRequestException(`Invalid operating hours format for ${day}: ${range}`);
      }
    }
  }
}
