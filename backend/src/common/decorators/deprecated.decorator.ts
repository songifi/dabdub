import { SetMetadata } from '@nestjs/common';

export const DEPRECATED_METADATA_KEY = 'deprecated';

export interface DeprecatedOptions {
  /** ISO date when the endpoint will be removed (RFC 8594 Sunset) */
  sunsetDate: string;
  /** URL to migration docs or the replacement endpoint */
  link: string;
  /** Human-readable deprecation notice */
  message: string;
}

/**
 * Marks an endpoint as deprecated.
 * The DeprecationInterceptor reads this metadata and injects
 * RFC 8594 Deprecation / Sunset / Link / X-Deprecation-Notice headers.
 *
 * @example
 * @Deprecated({ sunsetDate: '2027-01-01', link: '/docs/api-versioning', message: 'Use v2.' })
 * @Get('old-endpoint')
 * oldEndpoint() {}
 */
export const Deprecated = (options: DeprecatedOptions) =>
  SetMetadata(DEPRECATED_METADATA_KEY, options);
