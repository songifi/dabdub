# HTTP API versioning

## URL layout

- **Versioned REST** lives under `/api/v{n}/…` (for example `/api/v1/auth/login`). Major version is in the path segment after the global prefix `api`.
- **Version discovery** is not versioned: `GET /api/version` returns which major versions are current, supported, and deprecated.

NestJS is configured with URI versioning (`VersioningType.URI`). Controllers declare `version: '1'` (and future `'2'`, etc.) so adding v2 does not require changing the global prefix.

## Policy

- **Supported versions**: Listed in `GET /api/version` and in `src/api-version/api-version.policy.ts` (`API_VERSION_POLICY`).
- **Deprecation window**: Once a major version is marked deprecated, it remains available for **at least six calendar months** before the **Sunset** date. Clients should migrate before Sunset.
- **Deprecation responses**: Deprecated routes may be annotated with `@Deprecated(sunsetDate, successorPath)` from `src/api-version/deprecated-route.decorator.ts`. Responses then include:
  - `Deprecation`: HTTP-date when deprecation applies ([RFC 9745](https://www.rfc-editor.org/rfc/rfc9745))
  - `Sunset`: last day the resource is guaranteed to be available ([RFC 8594](https://www.rfc-editor.org/rfc/rfc8594))
  - `Link`: `rel="successor-version"` pointing at the replacement path (absolute path, e.g. `/api/v2/...`)

The `Deprecation` date on the wire is computed as six months before the decorator’s `sunsetDate`, consistent with the minimum support window.

## Swagger / OpenAPI

- Non-production: `/api/docs` serves the **current** major version (from `API_VERSION_POLICY.current`). Each documented version also has `/api/docs/v1`, `/api/docs/v2`, etc. Each spec includes unversioned routes such as `/api/version`.
- CI / artifacts: `npm run generate:openapi` writes `docs/openapi-v1.json` (and additional files per version) plus `docs/openapi.json` as a copy of the latest documented version.

To document a new major version, extend `DOCUMENTED_API_VERSIONS` in `api-version.policy.ts`, add v2 controllers, and register another Swagger route in `main.ts` (already looped over `DOCUMENTED_API_VERSIONS`).

## Migrating

1. Call `GET /api/version` and follow `supported` / `deprecated` / `latestSunset`.
2. Point new work at the **current** major version from that payload.
3. For each deprecated route you use, read `Sunset` and `Link: rel="successor-version"` and switch before Sunset.

## Environment

- Set `API_PREFIX=api` (global HTTP prefix only). Nest adds the `v1` / `v2` segment; do not put `v1` in `API_PREFIX`.

## Operational logging

HTTP access logs include `apiVersion` (`v1`, `v2`, …) parsed from the path when present, or `null` for unversioned routes like `/api/version`.

## Reporting breaking changes

Report breaking changes (removal or incompatible behavior) via your normal engineering / security channel. Breaking changes ship in a **new major version**; older majors stay available through the published deprecation window where applicable.
