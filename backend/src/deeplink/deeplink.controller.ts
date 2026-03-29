import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { DeepLinkService } from './deeplink.service';
import { WEB_FALLBACK_BASE } from '../common/constants/deep-links';

const APP_STORE_URL = 'https://apps.apple.com/app/cheesewallet';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=xyz.cheesepay.app';

@ApiTags('deeplink')
@Controller({ version: '1' })
export class DeepLinkController {
  constructor(private readonly deepLinkService: DeepLinkService) {}

  /**
   * Public redirect page — attempts to open the app via JS; falls back to
   * App Store / Google Play after 2 seconds if the app is not installed.
   */
  @Get('deeplink/redirect')
  @ApiOperation({ summary: 'Public: redirect deep link to app or store' })
  redirect(@Query('to') to: string, @Res() res: Response): void {
    const deepLink = decodeURIComponent(to ?? '');
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Opening Cheese Wallet…</title>
</head>
<body>
  <p>Opening Cheese Wallet…</p>
  <script>
    var deepLink = ${JSON.stringify(deepLink)};
    var appStoreUrl = ${JSON.stringify(APP_STORE_URL)};
    var playStoreUrl = ${JSON.stringify(PLAY_STORE_URL)};
    var ua = navigator.userAgent || '';
    var storeUrl = /android/i.test(ua) ? playStoreUrl : appStoreUrl;

    var fallbackTimer = setTimeout(function () {
      window.location.replace(storeUrl);
    }, 2000);

    window.addEventListener('blur', function () {
      clearTimeout(fallbackTimer);
    });

    window.location.replace(deepLink);
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  /**
   * Apple App Site Association — required for iOS universal links.
   * Must be served at /.well-known/apple-app-site-association with no extension.
   */
  @Get('.well-known/apple-app-site-association')
  @Header('Content-Type', 'application/json')
  @ApiExcludeEndpoint()
  appleAppSiteAssociation() {
    return this.deepLinkService.getAppleAppSiteAssociation();
  }

  /**
   * Android Asset Links — required for Android app links.
   */
  @Get('.well-known/assetlinks.json')
  @Header('Content-Type', 'application/json')
  @ApiExcludeEndpoint()
  assetLinks() {
    return this.deepLinkService.getAssetLinks();
  }
}
