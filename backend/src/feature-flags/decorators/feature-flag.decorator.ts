import { SetMetadata } from '@nestjs/common';

export const FEATURE_FLAG_KEY = 'featureFlag:key';

/** Gate a route behind a user-level feature flag (404 if disabled for caller). */
export const FeatureFlag = (key: string) => SetMetadata(FEATURE_FLAG_KEY, key);
