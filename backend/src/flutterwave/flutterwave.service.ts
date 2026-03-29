import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { ConfigType } from '@nestjs/config';
import { firstValueFrom, AxiosError } from 'rxjs';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { flutterwaveConfig } from '../config/flutterwave.config';

const BANKS_CACHE_KEY = 'flw:banks:NG';
const BANKS_CACHE_TTL = 86_400; // 24 h
const RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 3_000;

export interface CreateVirtualAccountDto {
  email: string;
  bvn: string;
  firstname: string;
  lastname: string;
  narration: string;
}

export interface VirtualAccountResult {
  accountNumber: string;
  bankName: string;
  reference: string;
}

export interface InitiateTransferDto {
  accountBank: string;
  accountNumber: string;
  amount: number;
  narration: string;
  reference: string;
}

export interface TransferResult {
  id: number;
  status: string;
}

export interface BankItem {
  id: number;
  code: string;
  name: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class FlutterwaveService {
  private readonly logger = new Logger(FlutterwaveService.name);

  constructor(
    private readonly httpService: HttpService,

    @InjectRedis()
    private readonly redis: Redis,

    @Inject(flutterwaveConfig.KEY)
    private readonly cfg: ConfigType<typeof flutterwaveConfig>,
  ) {}

  // ── Virtual Accounts ────────────────────────────────────────────────────────

  async createVirtualAccount(dto: CreateVirtualAccountDto): Promise<VirtualAccountResult> {
    const data = await this.request<{
      account_number: string;
      bank_name: string;
      flw_ref: string;
    }>('POST', '/v3/virtual-account-numbers', {
      email: dto.email,
      is_permanent: true,
      bvn: dto.bvn,
      firstname: dto.firstname,
      lastname: dto.lastname,
      narration: dto.narration,
    });

    return {
      accountNumber: data.account_number,
      bankName: data.bank_name,
      reference: data.flw_ref,
    };
  }

  async getVirtualAccountTransactions(reference: string): Promise<unknown[]> {
    const data = await this.request<{ transactions: unknown[] }>(
      'GET',
      `/v3/virtual-account-numbers/${reference}/transactions`,
    );
    return data.transactions ?? [];
  }

  // ── Transfers ───────────────────────────────────────────────────────────────

  async initiateTransfer(dto: InitiateTransferDto): Promise<TransferResult> {
    const data = await this.request<{ id: number; status: string }>(
      'POST',
      '/v3/transfers',
      {
        account_bank: dto.accountBank,
        account_number: dto.accountNumber,
        amount: dto.amount,
        narration: dto.narration,
        currency: 'NGN',
        reference: dto.reference,
      },
    );
    return { id: data.id, status: data.status };
  }

  async verifyTransfer(id: number): Promise<string> {
    const data = await this.request<{ status: string }>('GET', `/v3/transfers/${id}`);
    return data.status;
  }

  // ── Webhooks ─────────────────────────────────────────────────────────────────

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const expected = this.cfg.webhookSecret;
    // Flutterwave sends the plain secret as verif-hash header
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    );
  }

  // ── Banks ───────────────────────────────────────────────────────────────────

  async getBanks(): Promise<BankItem[]> {
    const cached = await this.redis.get(BANKS_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as BankItem[];
    }

    const data = await this.request<BankItem[]>('GET', '/v3/banks/NG');
    await this.redis.set(BANKS_CACHE_KEY, JSON.stringify(data), 'EX', BANKS_CACHE_TTL);
    return data;
  }

  // ── Balance ─────────────────────────────────────────────────────────────────

  async getBalance(): Promise<{ currency: string; available_balance: number; ledger_balance: number }> {
    return this.request<{ currency: string; available_balance: number; ledger_balance: number }>(
      'GET',
      '/v3/balances/NGN',
    );
  }

  // ── Internal request with retry ─────────────────────────────────────────────

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const url = `${this.cfg.baseUrl}${path}`;
    const headers = { Authorization: `Bearer ${this.cfg.secretKey}` };

    let lastError: unknown;

    for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
      try {
        const obs =
          method === 'POST'
            ? this.httpService.post<{ status: string; data: T }>(url, body, { headers })
            : this.httpService.get<{ status: string; data: T }>(url, { headers });

        const response = await firstValueFrom(obs);
        return response.data.data;
      } catch (err) {
        lastError = err;

        if (err instanceof Error && 'response' in err) {
          const axiosErr = err as AxiosError<{ message?: string; code?: string }>;
          const status = axiosErr.response?.status;
          const code = axiosErr.response?.data?.code;
          const message = axiosErr.response?.data?.message ?? 'Flutterwave error';

          // Map known business errors — do not retry these
          if (status === 400 || status === 422) {
            if (code === 'INVALID_ACCOUNT' || message?.toLowerCase().includes('invalid account')) {
              throw new BadRequestException('Invalid account details');
            }
            if (code === 'DUPLICATE_REFERENCE' || message?.toLowerCase().includes('duplicate')) {
              throw new ConflictException('Duplicate transaction reference');
            }
            throw new BadRequestException(message);
          }

          if (status === 503 || message?.toLowerCase().includes('insufficient funds')) {
            throw new ServiceUnavailableException('Provider has insufficient funds');
          }

          // 5xx — retry
          if (status && status >= 500 && attempt < RETRY_ATTEMPTS) {
            this.logger.warn(`Flutterwave ${status} on ${path} — retrying (${attempt + 1}/${RETRY_ATTEMPTS})`);
            await sleep(RETRY_DELAY_MS);
            continue;
          }
        }

        // Non-retryable or retries exhausted
        break;
      }
    }

    throw lastError;
  }
}
