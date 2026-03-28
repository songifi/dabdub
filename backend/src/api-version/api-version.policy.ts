/**
 * Single source of truth for supported / deprecated API versions (URL segments v1, v2, …).
 * When shipping v2 or deprecating v1, update this module and add matching Nest controllers.
 */
export const API_VERSION_POLICY = {
  /** Recommended version for new integrations */
  current: 'v1' as const,
  /** Actively maintained major versions */
  supported: ['v1'] as const,
  /**
   * Versions still served but in a deprecation window (subset of supported that are slated for removal).
   */
  deprecated: [] as readonly { version: string; sunset: string }[],
  /** Minimum calendar months a deprecated version remains available after deprecation is announced */
  minDeprecationMonths: 6,
} as const;

export type VersionDiscoveryResponse = {
  current: string;
  supported: string[];
  deprecated: string[];
  latestSunset: string | null;
};

export function getVersionDiscovery(): VersionDiscoveryResponse {
  const deprecatedVersions = API_VERSION_POLICY.deprecated.map((d) => d.version);
  const sunsets = API_VERSION_POLICY.deprecated.map((d) => d.sunset);
  const latestSunset =
    sunsets.length === 0
      ? null
      : sunsets.reduce((a, b) => (a > b ? a : b), sunsets[0]!);

  return {
    current: API_VERSION_POLICY.current,
    supported: [...API_VERSION_POLICY.supported],
    deprecated: deprecatedVersions,
    latestSunset,
  };
}

/** Nest URI version strings (without the `v` prefix). */
export const DOCUMENTED_API_VERSIONS = ['1'] as const;
