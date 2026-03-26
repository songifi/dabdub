import {
  Injectable,
  Inject,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import type { ConfigType } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import { VirtualAccount, VirtualAccountProvider } from './entities/virtual-account.entity';
import { flutterwaveConfig } from '../config/flutterwave.config';
import { redisConfig } from '../config/redis.config';
import { CheeseGateway, WS_EVENTS } from '../ws/cheese.gateway';
import { RatesService } from '../rates/rates.service';
import { SorobanService } from '../soroban/soroban.service';
import { DepositsService } from '../deposits/deposits.service';

const DEDUP_TTL_SECONDS = 172_800; // 48 h

@Injectable()
export class VirtualAccountService {
  private readonly logger = new Logger(VirtualAccountService.name);
  private readonly redis: Redis;

  constructor(
    @InjectRepository(VirtualAccount)
    private readonly vaRepo: Repository<VirtualAccount>,

    private readonly httpService: HttpService,

    @Inject(flutterwaveConfig.KEY)
    private readonly fw: ConfigType<typeof flutterwaveConfig>,

    @Inject(redisConfig.KEY)
    redisCfg: ConfigType<typeof redisConfig>,

    private readonly gateway: CheeseGateway,

    private readonly ratesService: RatesService,

    private readonly sorobanService: SorobanService,

    private readonly depositsService: DepositsService,
  ) {
    this.redis = new Redis({
      host: redisCfg.host,
      port: redisCfg.port,
      password: redisCfg.password,
    });
    this.redis.on('error', (err: Error) =>
      this.logger.warn(`VA Redis error: ${err.message}`),
    );
  }

  async provision(userId: string): Promise<VirtualAccount> {
    const reference = `va_${userId}_${Date.now()}`;

    const { data } = await firstValueFrom(
      this.httpService.post(
        `${this.fw.baseUrl}/v3/virtual-account-numbers`,
        {
          email: `${userId}@cheese.app`,
          is_permanent: true,
          bvn: '00000000000', // placeholder — real flow passes user BVN
          tx_ref: reference,
          narration: 'Cheese wallet deposit',
        },
        { headers: { Authorization: `Bearer ${this.fw.secretKey}` } },
      ),
    );

    const va = this.vaRepo.create({
      userId,
      accountNumber: data.data.account_number as string,
      bankName: data.data.bank_name as string,
      reference,
      provider: VirtualAccountProvider.FLUTTERWAVE,
      expiresAt: null,
    });

    return this.vaRepo.save(va);
  }

  async getOrProvision(userId: string): Promise<VirtualAccount> {
    const existing = await this.vaRepo.findOne({ where: { userId } });
    if (existing) return existing;
    return this.provision(userId);
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    this.verifySignature(rawBody, signature);

    const payload = JSON.parse(rawBody.toString()) as Record<string, unknown>;

    // Only process successful credit events
    if (payload['event'] !== 'charge.completed') return;

    const data = payload['data'] as Record<string, unknown>;
    const reference = data['tx_ref'] as string | undefined;
    if (!reference) return;

    // Idempotency — SET NX returns null if key already exists
    const dedupKey = `va:event:${reference}`;
    const acquired = await this.redis.set(dedupKey, '1', 'EX', DEDUP_TTL_SECONDS, 'NX');
    if (acquired === null) {
      this.logger.debug(`Duplicate webhook reference ${reference} — skipping`);
      return;
    }

    const va = await this.vaRepo.findOne({ where: { reference } });
    if (!va) {
      this.logger.warn(`No virtual account found for reference ${reference}`);
      return;
    }

    const ngnAmount = data['amount'] as number;
    const usdcAmount = await this.ratesService.convertNgnToUsdc(ngnAmount);

    // Create deposit and transaction records
    await this.depositsService.createDeposit(
      va.userId,
      va,
      ngnAmount,
      usdcAmount,
      reference,
      data['flw_ref'] as string | undefined,
    );

    // Deposit to Soroban contract
    await this.sorobanService.deposit(va.userId, usdcAmount);

    this.logger.log(
      `Credited ${usdcAmount} USDC to user ${va.userId} (${ngnAmount} NGN via ${reference})`,
    );

    await this.gateway.emitToUser(va.userId, WS_EVENTS.BALANCE_UPDATED, {
      usdcAmount,
      ngnAmount,
      reference,
    });
  }

  private verifySignature(rawBody: Buffer, signature: string): void {
    const expected = crypto
      .createHmac('sha256', this.fw.webhookSecret)
      .update(rawBody)
      .digest('hex');

    const sigBuffer = Buffer.from(signature, 'hex');
    const expBuffer = Buffer.from(expected, 'hex');

    const valid =
      sigBuffer.length === expBuffer.length &&
      crypto.timingSafeEqual(sigBuffer, expBuffer);

    if (!valid) throw new UnauthorizedException('Invalid webhook signature');
  }
}
