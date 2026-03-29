import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { ConfigType } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import { premblyConfig } from '../config/prembly.config';
import { appConfig } from '../config/app.config';

const BVN_CACHE_TTL = 86_400; // 24 h
const NIN_CACHE_TTL = 86_400;

const BVN_REGEX = /^\d{11}$/;
const NIN_REGEX = /^\d{11}$/;

export interface VerifyResult {
  verified: boolean;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  phoneNumber?: string;
}

@Injectable()
export class PremblyService {
  private readonly logger = new Logger(PremblyService.name);

  constructor(
    private readonly httpService: HttpService,

    @InjectRedis()
    private readonly redis: Redis,

    @Inject(premblyConfig.KEY)
    private readonly cfg: ConfigType<typeof premblyConfig>,

    @Inject(appConfig.KEY)
    private readonly app: ConfigType<typeof appConfig>,
  ) {}

  async verifyBvn(bvn: string, _userId: string): Promise<VerifyResult> {
    if (!BVN_REGEX.test(bvn)) {
      throw new BadRequestException('BVN must be exactly 11 digits');
    }

    // Dev mock — no API charges in non-production
    if (this.app.nodeEnv !== 'production') {
      return this.mockVerified();
    }

    const cacheKey = `kyc:bvn:${createHash('sha256').update(bvn).digest('hex')}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.debug('BVN cache hit — skipping Prembly API call');
      return JSON.parse(cached) as VerifyResult;
    }

    const result = await this.callPrembly('/bvn', { number: bvn });

    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', BVN_CACHE_TTL);
    return result;
  }

  async verifyNin(nin: string, _userId: string): Promise<VerifyResult> {
    if (!NIN_REGEX.test(nin)) {
      throw new BadRequestException('NIN must be exactly 11 digits');
    }

    if (this.app.nodeEnv !== 'production') {
      return this.mockVerified();
    }

    const cacheKey = `kyc:nin:${createHash('sha256').update(nin).digest('hex')}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.debug('NIN cache hit — skipping Prembly API call');
      return JSON.parse(cached) as VerifyResult;
    }

    const result = await this.callPrembly('/nin', { number: nin });

    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', NIN_CACHE_TTL);
    return result;
  }

  async verifyBankAccount(
    accountNumber: string,
    bankCode: string,
  ): Promise<{ verified: boolean; accountName: string }> {
    const response = await this.callRaw<{
      data: { account_name: string };
      status: boolean;
    }>('/bank_account/advance', {
      number: accountNumber,
      bank_code: bankCode,
    });

    return {
      verified: response.status,
      accountName: response.data?.account_name ?? '',
    };
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private async callPrembly(endpoint: string, body: Record<string, string>): Promise<VerifyResult> {
    const response = await this.callRaw<{
      status: boolean;
      data: {
        firstname?: string;
        lastname?: string;
        first_name?: string;
        last_name?: string;
        birthdate?: string;
        phone?: string;
      };
    }>(endpoint, body);

    return {
      verified: response.status,
      firstName: response.data?.firstname ?? response.data?.first_name ?? '',
      lastName: response.data?.lastname ?? response.data?.last_name ?? '',
      dateOfBirth: response.data?.birthdate,
      phoneNumber: response.data?.phone,
    };
  }

  private async callRaw<T>(endpoint: string, body: Record<string, string>): Promise<T> {
    const url = `${this.cfg.baseUrl}${endpoint}`;

    try {
      const obs = this.httpService.post<T>(url, body, {
        headers: {
          'x-api-key': this.cfg.apiKey,
          'app-id': this.cfg.appId,
          'Content-Type': 'application/json',
        },
      });
      const response = await firstValueFrom(obs);
      return response.data;
    } catch (err) {
      // Never leak raw API errors to client
      this.logger.error(`Prembly ${endpoint} error: ${String(err)}`);
      throw new BadRequestException('Identity verification service unavailable');
    }
  }

  private mockVerified(): VerifyResult {
    return {
      verified: true,
      firstName: 'Test',
      lastName: 'User',
      dateOfBirth: '1990-01-01',
      phoneNumber: '+2348000000000',
    };
  }
}
