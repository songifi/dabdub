import { SetMetadata } from '@nestjs/common';

export const THROTTLE_BY_API_KEY = 'throttleByApiKey';

/**
 * Use the X-API-Key header value as the throttle key instead of the client IP.
 * Apply this to routes authenticated by API key so limits are per-key rather
 * than per-IP (useful when multiple services share an egress IP).
 */
export const ThrottleByApiKey = () => SetMetadata(THROTTLE_BY_API_KEY, true);
