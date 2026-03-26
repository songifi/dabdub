import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import type { ConfigType } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { redisConfig } from '../config/redis.config';
import { paystackConfig } from '../config/paystack.config';
import { User } from '../users/entities/user.entity';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { BankAccount } from './entities/bank-account.entity';

const MAX_BANK_ACCOUNTS = 3;
const BANKS_CACHE_TTL_SECONDS = 86_400;
const PAYSTACK_BANKS_CACHE_KEY = 'paystack:banks:list';

type PaystackResolveResponse = {
  status: boolean;
  message: string;
  data: {
    account_number: string;
    account_name: string;
    bank_id?: number;
  };
};

type PaystackBanksResponse = {
  status: boolean;
  message: string;
  data: Array<{
    name: string;
    code: string;
  }>;
};

@Injectable()
export class BankAccountsService {
  private readonly redis: Redis;

  constructor(
    @InjectRepository(BankAccount)
    private readonly bankAccountRepo: Repository<BankAccount>,

    private readonly httpService: HttpService,

    @Inject(paystackConfig.KEY)
    private readonly paystack: ConfigType<typeof paystackConfig>,

    @Inject(redisConfig.KEY)
    redisCfg: ConfigType<typeof redisConfig>,
  ) {
    this.redis = new Redis({
      host: redisCfg.host,
      port: redisCfg.port,
      password: redisCfg.password,
    });
  }

  async createForUser(
    user: User,
    dto: CreateBankAccountDto,
  ): Promise<BankAccount> {
    const existingCount = await this.bankAccountRepo.count({
      where: { userId: user.id },
    });
    if (existingCount >= MAX_BANK_ACCOUNTS) {
      throw new BadRequestException('Maximum of 3 bank accounts allowed');
    }

    const resolved = await this.resolveAccount(dto.bankCode, dto.accountNumber);
    let bankName = dto.bankCode;
    try {
      const banks = await this.getBanks();
      bankName =
        banks.find((bank) => bank.code === dto.bankCode)?.name ?? dto.bankCode;
    } catch {
      bankName = dto.bankCode;
    }

    const entity = this.bankAccountRepo.create({
      userId: user.id,
      bankCode: dto.bankCode,
      bankName,
      accountNumber: dto.accountNumber,
      accountName: resolved.accountName,
      isDefault: existingCount === 0,
      isVerified: true,
    });

    return this.bankAccountRepo.save(entity);
  }

  async listVerifiedForUser(user: User): Promise<BankAccount[]> {
    return this.bankAccountRepo.find({
      where: { userId: user.id, isVerified: true },
      order: { createdAt: 'DESC' },
    });
  }

  async deleteForUser(user: User, id: string): Promise<void> {
    const account = await this.bankAccountRepo.findOne({
      where: { id, userId: user.id },
    });
    if (!account) {
      throw new NotFoundException('Bank account not found');
    }

    if (account.isDefault) {
      const othersCount = await this.bankAccountRepo.count({
        where: { userId: user.id },
      });
      if (othersCount > 1) {
        throw new BadRequestException('Set a new default first');
      }
    }

    await this.bankAccountRepo.delete({ id, userId: user.id });
  }

  async setDefaultForUser(user: User, id: string): Promise<void> {
    const account = await this.bankAccountRepo.findOne({
      where: { id, userId: user.id },
    });
    if (!account) {
      throw new NotFoundException('Bank account not found');
    }

    await this.bankAccountRepo
      .createQueryBuilder()
      .update(BankAccount)
      .set({
        isDefault: () => `CASE WHEN id = :targetId THEN true ELSE false END`,
      })
      .where('user_id = :userId', { userId: user.id })
      .setParameters({ targetId: id })
      .execute();
  }

  async getBanks(): Promise<Array<{ code: string; name: string }>> {
    const cached = await this.redis.get(PAYSTACK_BANKS_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as Array<{ code: string; name: string }>;
    }

    try {
      const { data } = await firstValueFrom(
        this.httpService.get<PaystackBanksResponse>(
          `${this.paystack.baseUrl}/bank`,
          {
            headers: { Authorization: `Bearer ${this.paystack.secretKey}` },
          },
        ),
      );

      const banks = (data.data ?? []).map(
        (bank: { code: string; name: string }) => ({
          code: bank.code,
          name: bank.name,
        }),
      );

      await this.redis.set(
        PAYSTACK_BANKS_CACHE_KEY,
        JSON.stringify(banks),
        'EX',
        BANKS_CACHE_TTL_SECONDS,
      );

      return banks;
    } catch {
      throw new BadGatewayException('Failed to fetch banks');
    }
  }

  private async resolveAccount(
    bankCode: string,
    accountNumber: string,
  ): Promise<{ accountName: string }> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<PaystackResolveResponse>(
          `${this.paystack.baseUrl}/bank/resolve`,
          {
            headers: { Authorization: `Bearer ${this.paystack.secretKey}` },
            params: {
              account_number: accountNumber,
              bank_code: bankCode,
            },
          },
        ),
      );

      return { accountName: data.data.account_name };
    } catch (error: unknown) {
      const e = error as { response?: { status?: number } };
      if (e.response?.status === 422) {
        throw new BadRequestException('Account number not found');
      }
      throw new BadGatewayException('Failed to resolve bank account');
    }
  }
}
