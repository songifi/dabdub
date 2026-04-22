import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import * as QRCode from 'qrcode';
import { createHash } from 'crypto';
import { PayLink, PayLinkStatus } from '../paylink/entities/pay-link.entity';
import { QrResponseDto } from './dto/qr-response.dto';

const DEEP_LINK_SCHEME = 'cheesewallet://';
const WEB_FALLBACK_BASE = 'https://pay.cheesewallet.app';
const CACHE_TTL_SECONDS = 3600;
const QR_WIDTH = 300;

@Injectable()
export class QrService {
  private readonly logger = new Logger(QrService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectRepository(PayLink)
    private readonly payLinkRepo: Repository<PayLink>,
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
    const params = new URLSearchParams({ to: username });
    if (amount) params.set('amount', amount);
    if (note) params.set('note', note);

    const paymentUrl = `${DEEP_LINK_SCHEME}pay?${params.toString()}`;

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

    const params = new URLSearchParams({ id: tokenId });
    const paymentUrl = `${DEEP_LINK_SCHEME}paylink?${params.toString()}`;

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
   * Useful for embedding in email/HTML where deep links may not work.
   */
  buildWebFallbackUrl(username: string): string {
    return `${WEB_FALLBACK_BASE}/${encodeURIComponent(username)}`;
  }

  private async renderQr(content: string): Promise<string> {
    return QRCode.toDataURL(content, {
      errorCorrectionLevel: 'M',
      width: QR_WIDTH,
      margin: 2,
    });
  }

  /**
   * SHA-256 hash of the params object → stable, collision-resistant cache key.
   */
  private buildCacheKey(params: Record<string, string | undefined>): string {
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
}
