import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import * as QRCode from 'qrcode';
import { createHash } from 'crypto';
import { PayLink, PayLinkStatus } from '../paylink/entities/pay-link.entity';
import { QrResponseDto } from './dto/qr-response.dto';
import { DeepLinkService } from '../deeplink/deeplink.service';
import { DeepLinkType, DEEP_LINK_SCHEME } from '../common/constants/deep-links';

const CACHE_TTL_SECONDS = 3600;
const QR_WIDTH = 300;

@Injectable()
export class QrService {
  private readonly logger = new Logger(QrService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectRepository(PayLink)
    private readonly payLinkRepo: Repository<PayLink>,
    private readonly deepLinkService: DeepLinkService,
  ) {}

  /**
   * Generates a QR code for @username payments.
   * Deep link: cheesewallet://pay?to={username}&amount={optional}&note={optional}
   * Web fallback: https://pay.cheesewallet.app/{username}
   */
  async generateUserQr(
    username: string,
    amount?: string,
    note?: string,
  ): Promise<QrResponseDto> {
    const deepLink = this.deepLinkService.generate(DeepLinkType.PAY, { to: username, amount });
    const paymentUrl = this.deepLinkService.generateWebFallback(deepLink);

    const cacheKey = this.buildCacheKey({
      type: 'user',
      username,
      amount,
      note,
    });
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      this.logger.debug(`QR cache hit: ${cacheKey}`);
      return { qrDataUrl: cached, paymentUrl };
    }

    const qrDataUrl = await this.renderQr(paymentUrl);
    await this.redis.set(cacheKey, qrDataUrl, 'EX', CACHE_TTL_SECONDS);

    return { qrDataUrl, paymentUrl };
  }

  /**
   * Generates a QR code for a PayLink checkout.
   * Deep link: cheesewallet://paylink?id={tokenId}
   * Validates that the PayLink exists and is active before generating.
   */
  async generatePayLinkQr(tokenId: string): Promise<QrResponseDto> {
    const payLink = await this.payLinkRepo.findOne({ where: { tokenId } });

    if (!payLink || payLink.status !== PayLinkStatus.ACTIVE) {
      throw new BadRequestException(
        `PayLink "${tokenId}" does not exist or is not active`,
      );
    }

    const deepLink = this.deepLinkService.generate(DeepLinkType.PAYLINK, { id: tokenId });
    const paymentUrl = this.deepLinkService.generateWebFallback(deepLink);

    const cacheKey = this.buildCacheKey({ type: 'paylink', tokenId });
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      this.logger.debug(`QR cache hit: ${cacheKey}`);
      return { qrDataUrl: cached, paymentUrl };
    }

    const qrDataUrl = await this.renderQr(paymentUrl);
    await this.redis.set(cacheKey, qrDataUrl, 'EX', CACHE_TTL_SECONDS);

    return { qrDataUrl, paymentUrl };
  }

  /**
   * Builds the web fallback URL for a username.
   * Delegates to DeepLinkService so URL format stays consistent.
   */
  buildWebFallbackUrl(username: string): string {
    const deepLink = this.deepLinkService.generate(DeepLinkType.PAY, { to: username });
    return this.deepLinkService.generateWebFallback(deepLink);
  }

async renderQr(content: string): Promise<string> {
    return QRCode.toDataURL(content, {
      errorCorrectionLevel: 'M',
      width: QR_WIDTH,
      margin: 2,
    });
  }

  /**
   * SHA-256 hash of the params object → stable, collision-resistant cache key.
   */
  buildCacheKey(params: Record<string, string | undefined>): string {
    const normalized = Object.keys(params)
      .sort()
      .reduce<Record<string, string>>((acc, k) => {
        if (params[k] !== undefined) acc[k] = params[k]!;
        return acc;
      }, {});

    const hash = createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex')
      .slice(0, 32); // 128-bit prefix is more than sufficient

    return `qr:${hash}`;
  }

  /**
   * Generate merchant POS QR: persistent for no-amount, one-time with amount/note
   * Cache: pos:qr:{merchantId} TTL 86400 (persistent), or hashed for one-time
   */
  async generatePosQr(
    username: string,
    merchantId: string,
    amount?: string,
    note?: string,
  ): Promise<{ qrDataUrl: string; paymentUrl: string }> {
    const deepLink = this.deepLinkService.generate(DeepLinkType.PAY, { to: username, amount });
    const paymentUrl = this.deepLinkService.generateWebFallback(deepLink);

    const isPersistent = !amount && !note;
    const cacheKey = isPersistent 
      ? `pos:qr:${merchantId}` 
      : this.buildCacheKey({ type: 'pos', merchantId, amount, note });

    const ttl = isPersistent ? 86400 : CACHE_TTL_SECONDS;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.debug(`POS QR cache hit: ${cacheKey}`);
      return { qrDataUrl: cached, paymentUrl };
    }

    const qrDataUrl = await this.renderQr(paymentUrl);
    await this.redis.set(cacheKey, qrDataUrl, 'EX', ttl);

    this.logger.debug(`POS QR generated & cached: ${cacheKey}`);
    return { qrDataUrl, paymentUrl };
  }
