import { SetMetadata } from '@nestjs/common';

export const DEPRECATED_ROUTE_KEY = 'deprecatedRoute' as const;

export type DeprecatedRouteMetadata = {
  sunset: Date;
  successorPath: string;
  deprecatedSince: Date;
};

function sunsetDate(value: string | Date): Date {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error('@Deprecated: invalid sunset date');
  }
  return d;
}

/**
 * Marks a route as deprecated. An interceptor adds Deprecation, Sunset, and Link (successor-version) headers.
 * Deprecation date defaults to six months before `sunsetDate` (see API_VERSION_POLICY.minDeprecationMonths).
 *
 * @param successorPath Full path of the replacement (e.g. `/api/v2/auth/login`).
 */
export function Deprecated(sunsetDateInput: string | Date, successorPath: string) {
  const sunset = sunsetDate(sunsetDateInput);
  const deprecatedSince = new Date(sunset.getTime());
  deprecatedSince.setUTCMonth(deprecatedSince.getUTCMonth() - 6);

  const meta: DeprecatedRouteMetadata = {
    sunset,
    successorPath,
    deprecatedSince,
  };
  return SetMetadata(DEPRECATED_ROUTE_KEY, meta);
}
