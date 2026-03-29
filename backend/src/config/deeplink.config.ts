import { registerAs } from '@nestjs/config';

export interface DeeplinkConfig {
  appleTeamId: string;
  appleBundleId: string;
  androidPackage: string;
  androidSha256: string;
}

export const deeplinkConfig = registerAs(
  'deeplink',
  (): DeeplinkConfig => ({
    appleTeamId: process.env['APPLE_TEAM_ID']!,
    appleBundleId: process.env['APPLE_BUNDLE_ID']!,
    androidPackage: process.env['ANDROID_PACKAGE']!,
    androidSha256: process.env['ANDROID_SHA256_FINGERPRINT']!,
  }),
);
