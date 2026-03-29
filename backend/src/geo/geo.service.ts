import { Inject, Injectable } from '@nestjs/common';
import geoip from 'geoip-lite';
import Redis from 'ioredis';
import { AppConfigService } from '../app-config/app-config.service';
import { REDIS_CLIENT } from '../cache/redis.module';

export interface GeoLocationContext {
  country: string;
  city?: string;
  region?: string;
  isVpn: boolean;
  isDatacenter: boolean;
}

@Injectable()
export class GeoService {
  constructor(
    private readonly appConfigService: AppConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  getCountry(ip: string | null | undefined): string {
    const normalizedIp = this.normalizeIp(ip);
    if (!normalizedIp || this.isPrivateOrLocalIp(normalizedIp)) {
      return 'NG';
    }

    const lookup = geoip.lookup(normalizedIp);
    return lookup?.country?.toUpperCase() ?? 'NG';
  }

  async isAllowed(ip: string | null | undefined): Promise<boolean> {
    const country = this.getCountry(ip);
    const configuredCountries = await this.appConfigService.get<string[]>(
      'allowed_countries',
      ['NG'],
    );
    const allowedCountries = (configuredCountries ?? ['NG']).map((value) =>
      String(value).toUpperCase(),
    );
    return allowedCountries.includes(country);
  }

  async getLocationContext(
    ip: string | null | undefined,
  ): Promise<GeoLocationContext> {
    const normalizedIp = this.normalizeIp(ip);
    const lookup = normalizedIp ? geoip.lookup(normalizedIp) : null;

    return {
      country: this.getCountry(normalizedIp),
      city: lookup?.city,
      region: lookup?.region,
      isVpn: await this.isVpn(normalizedIp),
      isDatacenter: await this.isDatacenter(normalizedIp),
    };
  }

  async recordBlockedCountry(country: string): Promise<void> {
    const now = new Date();
    const hourKey = `geo:blocked:${now.getUTCFullYear()}-${String(
      now.getUTCMonth() + 1,
    ).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}-${String(
      now.getUTCHours(),
    ).padStart(2, '0')}`;

    await this.redis.hincrby(hourKey, country, 1);
    await this.redis.expire(hourKey, 26 * 60 * 60);
  }

  async getBlockedCountryStatsLast24h(): Promise<Record<string, number>> {
    const totals: Record<string, number> = {};

    for (let i = 0; i < 24; i += 1) {
      const at = new Date(Date.now() - i * 60 * 60 * 1000);
      const key = `geo:blocked:${at.getUTCFullYear()}-${String(
        at.getUTCMonth() + 1,
      ).padStart(2, '0')}-${String(at.getUTCDate()).padStart(2, '0')}-${String(
        at.getUTCHours(),
      ).padStart(2, '0')}`;
      const bucket = await this.redis.hgetall(key);
      for (const [country, count] of Object.entries(bucket)) {
        totals[country] = (totals[country] ?? 0) + Number.parseInt(count, 10);
      }
    }

    return totals;
  }

  normalizeIp(ip: string | null | undefined): string {
    if (!ip) return '';
    const raw = ip.split(',')[0]?.trim() ?? '';
    if (raw.startsWith('::ffff:')) {
      return raw.slice('::ffff:'.length);
    }
    return raw;
  }

  private isPrivateOrLocalIp(ip: string): boolean {
    if (ip === '::1' || ip === 'localhost') return true;

    return (
      ip.startsWith('127.') ||
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
      ip.startsWith('fc') ||
      ip.startsWith('fd')
    );
  }

  private async isVpn(ip: string): Promise<boolean> {
    if (!ip || this.isPrivateOrLocalIp(ip)) return false;
    const vpnCidrs = await this.appConfigService.get<string[]>('vpn_cidrs', []);
    return this.matchesAnyCidr(ip, vpnCidrs ?? []);
  }

  private async isDatacenter(ip: string): Promise<boolean> {
    if (!ip || this.isPrivateOrLocalIp(ip)) return false;
    const datacenterCidrs = await this.appConfigService.get<string[]>(
      'datacenter_cidrs',
      [],
    );
    return this.matchesAnyCidr(ip, datacenterCidrs ?? []);
  }

  private matchesAnyCidr(ip: string, cidrs: string[]): boolean {
    return cidrs.some((cidr) => this.isIpInCidr(ip, cidr));
  }

  private isIpInCidr(ip: string, cidr: string): boolean {
    const [network, maskLengthRaw] = cidr.split('/');
    if (!network || !maskLengthRaw) return false;

    const ipInt = this.ipv4ToInt(ip);
    const networkInt = this.ipv4ToInt(network);
    const maskLength = Number.parseInt(maskLengthRaw, 10);

    if (
      ipInt === null ||
      networkInt === null ||
      Number.isNaN(maskLength) ||
      maskLength < 0 ||
      maskLength > 32
    ) {
      return false;
    }

    const mask =
      maskLength === 0 ? 0 : (0xffffffff << (32 - maskLength)) >>> 0;
    return (ipInt & mask) === (networkInt & mask);
  }

  private ipv4ToInt(ip: string): number | null {
    const octets = ip.split('.');
    if (octets.length !== 4) return null;

    const values = octets.map((value) => Number.parseInt(value, 10));
    if (values.some((value) => Number.isNaN(value) || value < 0 || value > 255)) {
      return null;
    }

    return (
      ((values[0] as number) << 24) |
      ((values[1] as number) << 16) |
      ((values[2] as number) << 8) |
      (values[3] as number)
    ) >>> 0;
  }
}
