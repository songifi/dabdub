import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { NotificationType } from '../notifications/notifications.types';
import { NotificationService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { Role } from '../rbac/rbac.types';
import { RegisterMerchantDto } from './dto/register-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { Merchant } from './entities/merchant.entity';

@Injectable()
export class MerchantsService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(Merchant)
    private readonly merchantRepo: Repository<Merchant>,

    private readonly notificationService: NotificationService,
  ) {}

  async register(user: User, dto: RegisterMerchantDto): Promise<Merchant> {
    const existing = await this.merchantRepo.findOne({
      where: { userId: user.id },
    });
    if (existing) {
      throw new ConflictException('Merchant profile already exists');
    }

    const merchant = await this.dataSource.transaction(
      async (trx: EntityManager) => {
        const merchantEntity = trx.getRepository(Merchant).create({
          userId: user.id,
          businessName: dto.businessName,
          businessType: dto.businessType,
          logoKey: dto.logoKey ?? null,
          description: dto.description ?? null,
          settlementCurrency: dto.settlementCurrency,
          autoSettleEnabled: dto.autoSettleEnabled ?? true,
          settlementThresholdUsdc: dto.threshold ?? 10,
        });

        const savedMerchant = await trx
          .getRepository(Merchant)
          .save(merchantEntity);

        user.isMerchant = true;
        user.role = UserRole.MERCHANT;
        await trx.getRepository(User).save(user);

        return savedMerchant;
      },
    );
    const merchant = await this.dataSource.transaction(async (trx: EntityManager) => {
      const merchantEntity = trx.getRepository(Merchant).create({
        userId: user.id,
        businessName: dto.businessName,
        businessType: dto.businessType,
        logoKey: dto.logoKey ?? null,
        description: dto.description ?? null,
        settlementCurrency: dto.settlementCurrency,
        autoSettleEnabled: dto.autoSettleEnabled ?? true,
        settlementThresholdUsdc: dto.threshold ?? 10,
      });

      const savedMerchant = await trx.getRepository(Merchant).save(merchantEntity);

      user.isMerchant = true;
      user.role = Role.Merchant;
      await trx.getRepository(User).save(user);

      return savedMerchant;
    });

    return merchant;
  }

  async getMe(user: User): Promise<Merchant> {
    if (!user.isMerchant) {
      throw new ForbiddenException('Merchant account required');
    }

    const merchant = await this.merchantRepo.findOne({
      where: { userId: user.id },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant profile not found');
    }

    return merchant;
  }

  async updateMe(user: User, dto: UpdateMerchantDto): Promise<Merchant> {
    const merchant = await this.getMe(user);

    if (dto.businessName !== undefined)
      merchant.businessName = dto.businessName;
    if (dto.businessType !== undefined)
      merchant.businessType = dto.businessType;
    if (dto.description !== undefined) merchant.description = dto.description;
    if (dto.logoKey !== undefined) merchant.logoKey = dto.logoKey;
    if (dto.settlementCurrency !== undefined) {
      merchant.settlementCurrency = dto.settlementCurrency;
    }
    if (dto.autoSettleEnabled !== undefined) {
      merchant.autoSettleEnabled = dto.autoSettleEnabled;
    }
    if (dto.threshold !== undefined) {
      merchant.settlementThresholdUsdc = dto.threshold;
    }

    return this.merchantRepo.save(merchant);
  }

  async getPublicByUsername(username: string): Promise<{
    businessName: string;
    logoKey: string | null;
    isVerified: boolean;
  }> {
    const merchant = await this.merchantRepo
      .createQueryBuilder('merchant')
      .innerJoin(User, 'user', 'user.id = merchant.user_id')
      .where('user.username = :username', { username })
      .select([
        'merchant.businessName AS "businessName"',
        'merchant.logoKey AS "logoKey"',
        'merchant.isVerified AS "isVerified"',
      ])
      .getRawOne<{
        businessName: string;
        logoKey: string | null;
        isVerified: boolean;
      }>();

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    return merchant;
  }

  async verifyMerchant(merchantId: string): Promise<Merchant> {
    const merchant = await this.merchantRepo.findOne({
      where: { id: merchantId },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    if (!merchant.isVerified) {
      merchant.isVerified = true;
      await this.merchantRepo.save(merchant);

      await this.notificationService.create(
        merchant.userId,
        NotificationType.SYSTEM,
        'Merchant account verified',
        'Your merchant profile is now verified and shows a verified badge.',
        { merchantId: merchant.id },
      );
    }

    return merchant;
  }
}
