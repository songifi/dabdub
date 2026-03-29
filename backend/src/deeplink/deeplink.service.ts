import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import {
  DEEP_LINK_SCHEME,
  WEB_FALLBACK_BASE,
  DeepLinkType,
  DeepLinkPatterns,
} from '../common/constants/deep-links';
import { deeplinkConfig } from '../config/deeplink.config';

@Injectable()
export class DeepLinkService {
  constructor(
    @Inject(deeplinkConfig.KEY)
    private readonly cfg: ConfigType<typeof deeplinkConfig>,
  ) {}

  /**
   * Builds a deep link URL with proper encoding.
   * Validates all required params before building.
   */
  generate<T extends DeepLinkType>(type: T, params: DeepLinkPatterns[T]): string {
    switch (type) {
      case DeepLinkType.PAY: {
        const p = params as DeepLinkPatterns[DeepLinkType.PAY];
        if (!p.to) throw new BadRequestException('PAY deep link requires "to" param');
        const qs = new URLSearchParams({ to: p.to });
        if (p.amount) qs.set('amount', p.amount);
        return `${DEEP_LINK_SCHEME}pay?${qs.toString()}`;
      }

      case DeepLinkType.PAYLINK: {
        const p = params as DeepLinkPatterns[DeepLinkType.PAYLINK];
        if (!p.id) throw new BadRequestException('PAYLINK deep link requires "id" param');
        return `${DEEP_LINK_SCHEME}paylink?${new URLSearchParams({ id: p.id }).toString()}`;
      }

      case DeepLinkType.PROFILE: {
        const p = params as DeepLinkPatterns[DeepLinkType.PROFILE];
        if (!p.username) throw new BadRequestException('PROFILE deep link requires "username" param');
        return `${DEEP_LINK_SCHEME}profile/${encodeURIComponent(p.username)}`;
      }

      case DeepLinkType.ACTIVITY: {
        const p = params as DeepLinkPatterns[DeepLinkType.ACTIVITY];
        if (!p.txId) throw new BadRequestException('ACTIVITY deep link requires "txId" param');
        return `${DEEP_LINK_SCHEME}activity/${encodeURIComponent(p.txId)}`;
      }

      case DeepLinkType.INVITE: {
        const p = params as DeepLinkPatterns[DeepLinkType.INVITE];
        if (!p.ref) throw new BadRequestException('INVITE deep link requires "ref" param');
        return `${DEEP_LINK_SCHEME}invite?${new URLSearchParams({ ref: p.ref }).toString()}`;
      }

      case DeepLinkType.KYC:
        return `${DEEP_LINK_SCHEME}kyc`;

      case DeepLinkType.EARN:
        return `${DEEP_LINK_SCHEME}earn`;

      default:
        throw new BadRequestException(`Unknown deep link type: ${String(type)}`);
    }
  }

  /**
   * Generates https://pay.cheesepay.xyz/redirect?to={encodedDeepLink}
   * The web page attempts to open the app and falls back to the store after 2s.
   */
  generateWebFallback(deepLink: string): string {
    const encoded = encodeURIComponent(deepLink);
    return `${WEB_FALLBACK_BASE}/redirect?to=${encoded}`;
  }

  /** AASA JSON payload for iOS universal links */
  getAppleAppSiteAssociation(): object {
    return {
      applinks: {
        apps: [],
        details: [
          {
            appID: `${this.cfg.appleTeamId}.${this.cfg.appleBundleId}`,
            paths: ['/redirect*', '/pay*', '/paylink*', '/invite*'],
          },
        ],
      },
    };
  }

  /** Asset links JSON payload for Android app links */
  getAssetLinks(): object[] {
    return [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: this.cfg.androidPackage,
          sha256_cert_fingerprints: [this.cfg.androidSha256],
        },
      },
    ];
  }
}
